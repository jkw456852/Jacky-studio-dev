export const ROUTES = {
  landing: '/',
  dashboard: '/dashboard',
  projects: '/projects',
  gptImageInspiration: '/gpt-image-inspiration',
  styleLibraryCenter: '/style-library-center',
  workspace: '/workspace',
  settings: '/settings',
  // 用户管理
  userLogin: '/user/login',
  userRegister: '/user/register',
  userForgotPassword: '/user/forgot-password',
  userDetail: '/user/detail',
} as const;

export const workspacePath = (id: string) => `${ROUTES.workspace}/${id}`;
export const createNewWorkspacePath = () => workspacePath(`new-${Date.now()}`);
