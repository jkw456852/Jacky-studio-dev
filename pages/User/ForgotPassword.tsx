import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  getCurrentSession,
  requestPasswordReset,
  signOut,
  updateCurrentUserPassword,
} from '../../services/supabase/auth';
import { supabase } from '../../services/supabase/client';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const syncRecoveryMode = async () => {
      const hash = window.location.hash || '';
      const hasRecoveryToken = hash.includes('type=recovery') || hash.includes('access_token=');

      if (!hasRecoveryToken) {
        return;
      }

      const { data } = await getCurrentSession();

      if (isMounted && data.session) {
        setIsRecoveryMode(true);
        setSuccessMessage('重置链接验证成功，请设置新密码。');
      }
    };

    void syncRecoveryMode();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && isMounted) {
        setIsRecoveryMode(true);
        setError('');
        setSuccessMessage('重置链接验证成功，请设置新密码。');
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccessMessage('');
  };

  const handleSendResetEmail = async () => {
    if (!formData.email) {
      setError('请输入邮箱地址');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const redirectTo = `${window.location.origin}/user/forgot-password`;
      const { error: requestError } = await requestPasswordReset(formData.email, redirectTo);

      if (requestError) {
        setError(requestError.message || '发送失败');
        return;
      }

      setSuccessMessage('重置邮件已发送，请检查邮箱并点击邮件中的链接继续设置新密码。');
    } catch (requestError) {
      console.error('Failed to request password reset', requestError);
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRecoveryMode) {
      await handleSendResetEmail();
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('密码长度至少8位');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const { error: updateError } = await updateCurrentUserPassword(formData.newPassword);

      if (updateError) {
        setError(updateError.message || '重置失败');
        return;
      }

      await signOut();
      alert('密码重置成功！请使用新密码登录');
      navigate('/user/login');
    } catch (updateError) {
      console.error('Failed to update password', updateError);
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          返回
        </button>

        <div className="text-center mb-8">
          <ShieldCheck className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">
            {isRecoveryMode ? '设置新密码' : '找回密码'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isRecoveryMode
              ? '请输入新密码并完成重置'
              : '输入注册邮箱，我们会发送密码重置链接到您的邮箱'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm leading-6">
              {successMessage}
            </div>
          )}

          {!isRecoveryMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <p className="mt-3 text-sm text-gray-500 leading-6">
                邮件中的重置链接会自动回到当前页面，验证成功后即可直接设置新密码。
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '发送中...' : '发送重置邮件'}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新密码
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="至少8位"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认新密码
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="再次输入新密码"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '处理中...' : '确认重置密码'}
              </button>
            </>
          )}

          <p className="text-center text-sm text-gray-600">
            想起密码了？{' '}
            <Link to="/user/login" className="text-blue-600 hover:text-blue-800 font-medium">
              立即登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
