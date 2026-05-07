import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthSession } from '../../hooks/useAuthSession';
import { ROUTES } from '../../utils/routes';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { status, isAuthenticated } = useAuthSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="text-base font-semibold text-gray-900">正在验证登录状态</div>
          <div className="mt-2 text-sm leading-6 text-gray-500">
            请稍候，正在检查当前账号会话。
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`;
    const params = new URLSearchParams();

    if (redirect && redirect !== ROUTES.userLogin) {
      params.set('redirect', redirect);
    }

    const nextPath = params.toString()
      ? `${ROUTES.userLogin}?${params.toString()}`
      : ROUTES.userLogin;

    return <Navigate to={nextPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
