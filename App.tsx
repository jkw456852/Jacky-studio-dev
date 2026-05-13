import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthSessionProvider } from './hooks/useAuthSession';
import { ROUTES } from './utils/routes';

const Home = lazy(() => import('./pages/Home'));
const GptImageInspiration = lazy(() => import('./pages/GptImageInspiration'));
const Workspace = lazy(() => import('./pages/Workspace'));
const WorkspaceNew = lazy(() => import('./pages/Workspace/WorkspaceNew'));
const Projects = lazy(() => import('./pages/Projects'));
const Settings = lazy(() => import('./pages/Settings'));
const Landing = lazy(() => import('./pages/Landing'));
// 用户管理页面
const UserLogin = lazy(() => import('./pages/User/Login'));
const UserRegister = lazy(() => import('./pages/User/Register'));
const UserForgotPassword = lazy(() => import('./pages/User/ForgotPassword'));
const UserDetail = lazy(() => import('./pages/User/Detail'));

const App: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  return (
    <AuthSessionProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
            <Routes>
              <Route path={ROUTES.landing} element={<Landing />} />
              <Route path={ROUTES.dashboard} element={<Home onExit={onExit} />} />
              <Route path={ROUTES.projects} element={<Projects onExit={onExit} />} />
              <Route path={ROUTES.gptImageInspiration} element={<GptImageInspiration />} />
              <Route path={`${ROUTES.workspace}/:id`} element={<Workspace />} />
              {/* 新版Workspace - 使用Store和组件化架构 */}
              <Route path={`${ROUTES.workspaceNew}/:id`} element={<WorkspaceNew />} />
              <Route path={ROUTES.settings} element={<Settings />} />
              {/* 用户管理页面 */}
              <Route path={ROUTES.userLogin} element={<UserLogin />} />
              <Route path={ROUTES.userRegister} element={<UserRegister />} />
              <Route path={ROUTES.userForgotPassword} element={<UserForgotPassword />} />
              <Route
                path={ROUTES.userDetail}
                element={(
                  <ProtectedRoute>
                    <UserDetail />
                  </ProtectedRoute>
                )}
              />
              <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
            </Routes>
          </Suspense>
          <Analytics />
        </div>
      </Router>
    </AuthSessionProvider>
  );
};

export default App;
