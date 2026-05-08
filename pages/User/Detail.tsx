import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Cloud,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useAuthSession } from '../../hooks/useAuthSession';
import { syncAccountSecretsWithAccount } from '../../services/account-secrets';
import { syncLocalStudioUserAssetsToAccount } from '../../services/runtime-assets/account-sync';
import { getStudioUserAssetApi } from '../../services/runtime-assets/api';
import {
  getProjects,
  scanProjectLocalAssetRisk,
  type ProjectLocalRiskItem,
} from '../../services/storage';
import { useImageHostStore } from '../../stores/imageHost.store';
import { uploadImage } from '../../utils/uploader';
import { ROUTES } from '../../utils/routes';

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatProjectRiskSummary = (risk: ProjectLocalRiskItem): string => {
  const title = String(risk.projectTitle || '未命名项目').trim() || '未命名项目';
  const updatedAt = formatDateTime(risk.updatedAt);
  const sampleRef = risk.sampleRefs[0] ? `，示例资源：${risk.sampleRefs[0]}` : '';
  return `${title}（${risk.localAssetCount} 个本地资源，最近更新 ${updatedAt}${sampleRef}）`;
};

const describeSensitiveConfigSyncMode = (
  mode: 'restored_remote' | 'pushed_local' | 'noop',
): string => {
  if (mode === 'restored_remote') {
    return '已从账号恢复服务商配置、图床与三方密钥';
  }

  if (mode === 'pushed_local') {
    return '已将当前设备的服务商配置、图床与三方密钥同步到账号';
  }

  return '当前没有需要同步的敏感配置变更';
};

const buildSignOutConfirmationMessage = (args: {
  localProjectCount: number;
  riskyProjects: ProjectLocalRiskItem[];
  autoSyncError: string;
  hasAccessToken: boolean;
}): string => {
  const {
    localProjectCount,
    riskyProjects,
    autoSyncError,
    hasAccessToken,
  } = args;
  const riskyAssetCount = riskyProjects.reduce(
    (total, item) => total + item.localAssetCount,
    0,
  );
  const lines = [
    '退出后会清除当前设备上的账号敏感配置、账号资料、本地项目缓存与项目资源。',
  ];

  if (!hasAccessToken) {
    lines.push('当前会话缺少 access token，无法在退出前自动同步账号资产。');
  }

  if (autoSyncError) {
    lines.push(`退出前自动同步账号资产失败：${autoSyncError}`);
  }

  if (riskyProjects.length > 0) {
    lines.push(
      `检测到 ${riskyProjects.length} 个项目仍包含 ${riskyAssetCount} 个仅存于本地的资源引用，退出后将无法恢复：\n- ${riskyProjects
        .slice(0, 2)
        .map((item) => formatProjectRiskSummary(item))
        .join('\n- ')}${riskyProjects.length > 2 ? '\n- 其余项目请在退出前自行检查。' : ''}`,
    );
  } else if (localProjectCount > 0) {
    lines.push(`当前设备还有 ${localProjectCount} 个本地项目缓存，退出后会一并清除。`);
  }

  lines.push('是否继续退出并清除本地数据？');
  return lines.join('\n\n');
};

const UserDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, session, status, signOutAndClear } = useAuthSession();
  const userAssetApi = useMemo(() => getStudioUserAssetApi(), []);
  const imageHostProvider = useImageHostStore((state) => state.selectedProvider);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(() => userAssetApi.getUserProfile().avatarUrl);

  const profile = useMemo(() => {
    const email = user?.email || '未绑定邮箱';
    const username = String(user?.user_metadata?.username || '').trim();
    const displayName = username || email.split('@')[0] || '用户';

    return {
      email,
      username: username || '未设置',
      displayName,
      userId: user?.id || '—',
      createdAt: formatDateTime(user?.created_at),
      lastSignInAt: formatDateTime(user?.last_sign_in_at),
      sessionStatus: status === 'authenticated' ? '已登录' : '未登录',
      sessionExpiry: session?.expires_at
        ? formatDateTime(new Date(session.expires_at * 1000).toISOString())
        : '—',
    };
  }, [session?.expires_at, status, user]);

  const isAvatarUploadAvailable = imageHostProvider !== 'none';
  const avatarStatusText = avatarError
    || avatarMessage
    || (isAvatarUploadAvailable
      ? '头像会先保存到当前设备的账号资料层，点击下方“同步账号资产”后再同步到账号端。'
      : '当前未开启图床配置，头像上传入口已禁用，避免保存为不可同步的临时地址。');
  const avatarStatusClassName = avatarError
    ? 'border-red-100 bg-red-50 text-red-600'
    : avatarMessage
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : isAvatarUploadAvailable
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-amber-100 bg-amber-50 text-amber-700';

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isAvatarUploadAvailable) {
      setAvatarMessage('');
      setAvatarError('请先在设置中开启图床并配置可用密钥，再上传可同步头像。');
      return;
    }

    setAvatarUploading(true);
    setAvatarError('');
    setAvatarMessage('');

    try {
      const uploadedAvatarUrl = await uploadImage(file);

      if (!/^https?:\/\//i.test(uploadedAvatarUrl)) {
        throw new Error('头像上传未返回可持久化公网地址，请检查图床配置后重试。');
      }

      userAssetApi.setUserProfile({
        avatarUrl: uploadedAvatarUrl,
      });
      setAvatarUrl(uploadedAvatarUrl);
      setAvatarMessage('头像已保存到本地账号资料，可通过“同步账号资产”同步到账号端。');
    } catch (uploadError) {
      console.error('Failed to upload avatar', uploadError);
      setAvatarError(uploadError instanceof Error ? uploadError.message : '头像上传失败，请稍后重试');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    userAssetApi.setUserProfile({
      avatarUrl: '',
    });
    setAvatarUrl('');
    setAvatarError('');
    setAvatarMessage('头像已移除，当前显示默认占位头像。');
  };

  const handleSyncAssets = async () => {
    const accessToken = String(session?.access_token || '').trim();

    if (!accessToken) {
      setError('当前会话缺少 access token，无法同步账号资产。');
      return;
    }

    setSyncing(true);
    setError('');
    setSyncMessage('');

    let assetResult: Awaited<ReturnType<typeof syncLocalStudioUserAssetsToAccount>> | null = null;

    try {
      assetResult = await syncLocalStudioUserAssetsToAccount({
        accessToken,
      });
      const secretsResult = await syncAccountSecretsWithAccount({
        accessToken,
      });

      setSyncMessage(
        `同步完成：已合并本地与账号资产，远端审计记录 ${assetResult.remoteAuditCount} 条，合并决策 ${assetResult.decisions.length} 项；${describeSensitiveConfigSyncMode(secretsResult.mode)}。`,
      );
    } catch (syncError) {
      console.error('Failed to sync account assets', syncError);
      if (assetResult) {
        setSyncMessage(
          `普通账号资产已同步：远端审计记录 ${assetResult.remoteAuditCount} 条，合并决策 ${assetResult.decisions.length} 项。`,
        );
      }
      setError(syncError instanceof Error ? syncError.message : '账号资产同步失败，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    const accessToken = String(session?.access_token || '').trim();
    setLoading(true);
    setError('');
    setSyncMessage('');

    let autoSyncError = '';
    let autoSyncMessage = '';

    try {
      if (accessToken) {
        setSyncing(true);
        let assetResult: Awaited<ReturnType<typeof syncLocalStudioUserAssetsToAccount>> | null = null;
        try {
          assetResult = await syncLocalStudioUserAssetsToAccount({
            accessToken,
          });
          const secretsResult = await syncAccountSecretsWithAccount({
            accessToken,
          });
          autoSyncMessage = `退出前已自动同步账号资产：远端审计记录 ${assetResult.remoteAuditCount} 条，合并决策 ${assetResult.decisions.length} 项；${describeSensitiveConfigSyncMode(secretsResult.mode)}。`;
        } catch (syncError) {
          console.error('Failed to auto sync account assets before sign out', syncError);
          if (assetResult) {
            autoSyncMessage = `退出前已同步普通账号资产：远端审计记录 ${assetResult.remoteAuditCount} 条，合并决策 ${assetResult.decisions.length} 项。`;
            autoSyncError = syncError instanceof Error
              ? `敏感配置同步失败：${syncError.message}`
              : '敏感配置同步失败，请稍后重试';
          } else {
            autoSyncError = syncError instanceof Error
              ? syncError.message
              : '退出前自动同步账号资产失败，请稍后重试';
          }
        } finally {
          setSyncing(false);
        }
      }

      const projects = await getProjects();
      const riskyProjects = projects
        .map((project) => scanProjectLocalAssetRisk(project))
        .filter((item): item is ProjectLocalRiskItem => Boolean(item));
      const needsConfirmation = projects.length > 0 || riskyProjects.length > 0 || !!autoSyncError || !accessToken;

      if (needsConfirmation) {
        const confirmed = window.confirm(buildSignOutConfirmationMessage({
          localProjectCount: projects.length,
          riskyProjects,
          autoSyncError,
          hasAccessToken: Boolean(accessToken),
        }));

        if (!confirmed) {
          if (autoSyncMessage) {
            setSyncMessage(autoSyncMessage);
          }
          if (autoSyncError) {
            setError(autoSyncError);
          }
          return;
        }
      }

      await signOutAndClear({ clearWorkspaceData: true });
      navigate(ROUTES.userLogin, { replace: true });
    } catch (signOutError) {
      console.error('Failed to sign out', signOutError);
      setError(signOutError instanceof Error ? signOutError.message : '退出登录失败，请稍后重试');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <button
            onClick={() => navigate(ROUTES.dashboard)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
          >
            返回首页
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${profile.displayName} 的头像`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-7 w-7" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-semibold text-gray-900">
                    {profile.displayName}
                  </div>
                  <div className="mt-1 break-all text-sm leading-6 text-gray-500">
                    {profile.email}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-gray-500">
                    头像作为账号资料字段保存；需要跨设备生效时，请在下方点击“同步账号资产”。
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading || !isAvatarUploadAvailable}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Camera className="h-4 w-4" />
                        {avatarUploading ? '上传中...' : avatarUrl ? '更换头像' : '上传头像'}
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={avatarUploading}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          移除头像
                        </button>
                      )}
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${avatarStatusClassName}`}>
                      {avatarStatusText}
                    </div>
                  </div>
                </div>
              </div>
              <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <BadgeCheck className="h-4 w-4" />
                {profile.sessionStatus}
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-500">用户名</div>
              <div className="mt-2 text-base font-semibold text-gray-900 break-all">
                {profile.username}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <Mail className="h-4 w-4" />
                登录邮箱
              </div>
              <div className="mt-2 break-all text-base font-semibold text-gray-900">
                {profile.email}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-500">注册时间</div>
              <div className="mt-2 text-base font-semibold text-gray-900">
                {profile.createdAt}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-medium text-gray-500">最近登录</div>
              <div className="mt-2 text-base font-semibold text-gray-900">
                {profile.lastSignInAt}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <ShieldCheck className="h-4 w-4" />
                用户 ID
              </div>
              <div className="mt-2 break-all text-sm font-medium leading-6 text-gray-900">
                {profile.userId}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
              <div className="text-sm font-medium text-gray-500">当前会话到期时间</div>
              <div className="mt-2 text-base font-semibold text-gray-900">
                {profile.sessionExpiry}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 px-6 py-6 sm:px-8">
            {error && (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
                {error}
              </div>
            )}

            {syncMessage && (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {syncMessage}
              </div>
            )}

            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-800">
              当前“账号同步”会同时处理两层数据：一层是模型偏好、工作台偏好、主脑长期偏好、风格库、角色草稿、插件/技能偏好，以及头像这类用户资料字段；另一层是服务商配置、图床与三方密钥等账号敏感配置。
              项目内容与项目图片资源仍保留在当前设备。退出登录时会先尝试自动同步账号资产，再提示确认是否清除本地项目缓存与仅本地资源。
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-gray-500">
                当前页面已经接入统一认证状态层，并补了头像资料保存、普通账号资产同步，以及服务商配置/图床敏感配置恢复入口；退出登录时会自动检查本地项目是否仍含仅本地资源，并在确认后清理当前设备数据。
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSyncAssets}
                  disabled={syncing || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Cloud className="h-4 w-4" />
                  {syncing ? '同步中...' : '同步账号资产'}
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={loading || avatarUploading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {loading ? '退出中...' : '退出登录'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailPage;
