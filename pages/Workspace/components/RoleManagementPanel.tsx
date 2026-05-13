import React from 'react';
import { Camera, Loader2, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import type {
  AgentType,
  RoleGovernanceMode,
  StudioRoleEntity,
  StudioRoleVersionRecord,
} from '../../../types/agent.types';
import type { AgentRoleProfile } from '../../../services/agents/role-catalog';
import type {
  StudioStoredRoleDraft,
  StudioUserAssetAuditEntry,
} from '../../../services/runtime-assets/user-asset-types';
import { buildUserCustomRoleAddonBlock } from '../../../services/agents/role-config';
import { getAgentInfo } from '../../../services/agents';
import {
  getMappedPrimaryModelConfig,
  getModelDisplayLabel,
} from '../../../services/provider-settings';
import { generateImageWithProvider } from '../../../services/providers';
import { useImageHostStore } from '../../../stores/imageHost.store';
import { uploadImage } from '../../../utils/uploader';

type RoleEntityEditorDraft = {
  title: string;
  summary: string;
  avatarUrl: string;
  tagsText: string;
  useWhenText: string;
  avoidWhenText: string;
  durableRoleAddon: string;
  governanceMode: RoleGovernanceMode;
  allowMainBrainMutation: boolean;
  allowMainBrainPromotion: boolean;
  allowMainBrainArchive: boolean;
};

type RoleManagementPanelProps = {
  agentId: AgentType;
  roleId: string | null;
  roleInspectorDraft: string;
  inspectedHasAddon: boolean;
  inspectedPromptDirty: boolean;
  inspectedBuiltInPrompt: string;
  inspectedMainBrainBlock: string;
  inspectedEffectivePrompt: string;
  inspectedDurableRole: StudioRoleEntity | null;
  inspectedRoleVersions: StudioRoleVersionRecord[];
  inspectedRoleProfile: AgentRoleProfile | null;
  inspectedLatestRoleDraft: StudioStoredRoleDraft | null;
  selectedRoleId: string | null;
  inspectedRoleAuditEntries?: StudioUserAssetAuditEntry[];
  roleEntityDraft?: RoleEntityEditorDraft;
  roleEntityDirty?: boolean;
  roleEntityCanSubmit?: boolean;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onResetPromptAddon: () => void;
  onSavePromptAddon: () => void;
  onApplyLatestRoleDraft: () => void;
  onSaveLatestRoleDraftAsFormalRole: () => void;
  onClearLatestRoleDraft: () => void;
  onRoleEntityDraftChange?: (patch: Partial<RoleEntityEditorDraft>) => void;
  onSaveRoleEntity?: () => void;
  onResetRoleEntityDraft?: () => void;
  onRollbackRoleVersion?: (version: number) => void;
  onPublishRole?: () => void;
  onArchiveRole?: () => void;
};

const ROLE_GOVERNANCE_MODE_OPTIONS: Array<{
  value: RoleGovernanceMode;
  label: string;
  description: string;
}> = [
  {
    value: 'manual_only',
    label: '仅手动维护',
    description: '主脑只读取，不会主动改这个角色。',
  },
  {
    value: 'draft_only',
    label: '只给建议',
    description: '主脑可以先写候选方案，但要你确认后才生效。',
  },
  {
    value: 'approval_required',
    label: '改动先确认',
    description: '适合正式长期角色，重要改动都先过你。',
  },
  {
    value: 'auto_manage',
    label: '允许自动整理',
    description: '适合实验角色，允许主脑自动维护。',
  },
];

const getRoleStatusMeta = (role: StudioRoleEntity | null) => {
  switch (role?.status) {
    case 'active':
      return {
        label: '使用中',
        className: 'bg-emerald-50 text-emerald-700',
      };
    case 'archived':
      return {
        label: '已归档',
        className: 'bg-slate-100 text-slate-600',
      };
    case 'draft':
      return {
        label: '草稿',
        className: 'bg-amber-50 text-amber-700',
      };
    default:
      return {
        label: '未创建正式角色',
        className: 'bg-blue-50 text-blue-700',
      };
  }
};

const toLines = (value?: string | null): string[] =>
  String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const formatTime = (value?: number | null): string =>
  value ? new Date(value).toLocaleString('zh-CN') : '—';

const FieldBlock: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <label className="block min-w-0">
    <div className="text-[14px] font-semibold text-slate-900">{label}</div>
    {hint ? <div className="mt-1 text-[12px] leading-5 text-slate-500">{hint}</div> : null}
    <div className="mt-2">{children}</div>
  </label>
);

const SectionCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
    <div className="min-w-0">
      <h4 className="text-[16px] font-semibold text-slate-900">{title}</h4>
      {description ? <p className="mt-1 text-[12px] leading-5 text-slate-500">{description}</p> : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const TonePill: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = 'bg-slate-100 text-slate-700' }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>
    {children}
  </span>
);

export const RoleManagementPanel: React.FC<RoleManagementPanelProps> = ({
  agentId,
  roleId,
  roleInspectorDraft,
  inspectedHasAddon,
  inspectedPromptDirty,
  inspectedBuiltInPrompt,
  inspectedMainBrainBlock,
  inspectedEffectivePrompt,
  inspectedDurableRole,
  inspectedRoleVersions,
  inspectedRoleProfile,
  inspectedLatestRoleDraft,
  selectedRoleId,
  inspectedRoleAuditEntries = [],
  roleEntityDraft,
  roleEntityDirty = false,
  roleEntityCanSubmit = false,
  onClose,
  onDraftChange,
  onResetPromptAddon,
  onSavePromptAddon,
  onApplyLatestRoleDraft,
  onSaveLatestRoleDraftAsFormalRole,
  onClearLatestRoleDraft,
  onRoleEntityDraftChange,
  onSaveRoleEntity,
  onResetRoleEntityDraft,
  onRollbackRoleVersion,
  onPublishRole,
  onArchiveRole,
}) => {
  const inspectedAgentInfo = getAgentInfo(agentId);
  const statusMeta = getRoleStatusMeta(inspectedDurableRole);
  const useWhenList = inspectedRoleProfile?.useWhen || toLines(roleEntityDraft?.useWhenText);
  const avoidWhenList = inspectedRoleProfile?.avoidWhen || toLines(roleEntityDraft?.avoidWhenText);
  const previewPrompt = roleInspectorDraft.trim()
    ? [
        inspectedBuiltInPrompt,
        inspectedMainBrainBlock,
        buildUserCustomRoleAddonBlock(roleInspectorDraft.trim()),
      ]
        .filter(Boolean)
        .join('\n\n')
    : inspectedEffectivePrompt;
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const [avatarGenerating, setAvatarGenerating] = React.useState(false);
  const [avatarStatus, setAvatarStatus] = React.useState('');
  const [avatarError, setAvatarError] = React.useState('');
  const imageHostProvider = useImageHostStore((state) => state.selectedProvider);
  const isAvatarUploadAvailable = imageHostProvider !== 'none';
  const primaryImageConfig = React.useMemo(() => getMappedPrimaryModelConfig('image'), []);
  const avatarGenerationModelLabel = getModelDisplayLabel(
    primaryImageConfig?.modelId || 'NanoBanana2',
  );

  React.useEffect(() => {
    setAvatarStatus('');
    setAvatarError('');
  }, [agentId, roleId]);

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !roleEntityDraft) {
      return;
    }

    if (!isAvatarUploadAvailable) {
      setAvatarStatus('');
      setAvatarError('请先在设置中开启图床并配置可用密钥，再上传可同步头像。');
      return;
    }

    setAvatarUploading(true);
    setAvatarStatus('');
    setAvatarError('');

    try {
      const uploadedAvatarUrl = await uploadImage(file);
      if (!/^https?:\/\//i.test(uploadedAvatarUrl)) {
        throw new Error('头像上传未返回可持久化公网地址，请检查图床配置后重试。');
      }
      onRoleEntityDraftChange?.({ avatarUrl: uploadedAvatarUrl });
      setAvatarStatus('角色头像已上传，可直接保存到当前角色。');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : '角色头像上传失败，请稍后重试');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleGenerateAvatar = async () => {
    if (!roleEntityDraft) return;

    setAvatarGenerating(true);
    setAvatarStatus('');
    setAvatarError('');

    try {
      const prompt = [
        '请生成一个用于 AI 专家角色的 1:1 方形头像插画。',
        '风格要求：现代、简洁、专业、克制，适合真实 SaaS 产品界面；中性色为主，只保留低饱和点缀色；纯净背景；半身或头像构图；不要文字、不要水印、不要装饰边框。',
        `基础专家：${inspectedAgentInfo.name}`,
        `角色名称：${roleEntityDraft.title || `${inspectedAgentInfo.name} 角色`}`,
        roleEntityDraft.summary ? `角色简介：${roleEntityDraft.summary}` : '',
        roleEntityDraft.tagsText.trim() ? `角色标签：${roleEntityDraft.tagsText}` : '',
        roleEntityDraft.useWhenText.trim()
          ? `适用场景：${roleEntityDraft.useWhenText.replace(/\r?\n/g, '；')}`
          : '',
        roleEntityDraft.durableRoleAddon.trim()
          ? `长期规则关键词：${roleEntityDraft.durableRoleAddon.replace(/\s+/g, ' ').slice(0, 200)}`
          : '',
        '输出一张可直接作为产品内角色头像使用的单人角色插画。',
      ]
        .filter(Boolean)
        .join('\n');

      const resultUrl = await generateImageWithProvider(
        {
          prompt,
          providerId: primaryImageConfig?.providerId || null,
          aspectRatio: '1:1',
          imageSize: '1K',
          imageQuality: 'medium',
          promptLanguagePolicy: 'original-zh',
          textPolicy: {
            enforceChinese: false,
            requiredCopy: '',
          },
          referenceRoleMode: 'none',
        },
        primaryImageConfig?.modelId || 'NanoBanana2',
      );

      if (!resultUrl || !/^https?:\/\//i.test(resultUrl)) {
        throw new Error('AI 头像生成未返回可持久化公网地址，请稍后重试。');
      }

      onRoleEntityDraftChange?.({ avatarUrl: resultUrl });
      setAvatarStatus(`已使用 ${avatarGenerationModelLabel} 生成角色头像，可直接保存。`);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'AI 头像生成失败，请稍后重试');
    } finally {
      setAvatarGenerating(false);
    }
  };

  const handleRemoveAvatar = () => {
    onRoleEntityDraftChange?.({ avatarUrl: '' });
    setAvatarError('');
    setAvatarStatus('角色头像已移除，保存后将回退为默认专家图标。');
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/36 p-4">
      <button
        type="button"
        aria-label="close role inspector"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-[141] flex h-[min(90vh,940px)] w-[min(1120px,100%)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#fcfcfd] shadow-[0_28px_90px_-28px_rgba(15,23,42,0.38)]">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[20px] leading-none">{inspectedAgentInfo.avatar}</span>
                <h3 className="min-w-0 text-[20px] font-semibold text-slate-900">
                  {inspectedDurableRole ? inspectedDurableRole.title : `${inspectedAgentInfo.name} 角色`}
                </h3>
                <TonePill className={statusMeta.className}>{statusMeta.label}</TonePill>
                {selectedRoleId && inspectedDurableRole && selectedRoleId === inspectedDurableRole.id ? (
                  <TonePill className="bg-amber-50 text-amber-700">当前会话正在用</TonePill>
                ) : null}
                {!inspectedDurableRole && inspectedHasAddon ? (
                  <TonePill className="bg-blue-50 text-blue-700">已保存长期规则</TonePill>
                ) : null}
              </div>
              <p className="mt-2 max-w-[760px] text-[13px] leading-6 text-slate-500">
                {inspectedDurableRole
                  ? `下面这块白色表单区就是角色设定。按顺序修改名称、适用任务和规则后，再保存即可。`
                  : `下面这块白色表单区就是角色设定。你可以先补角色名称、适用任务和长期规则，再决定是否发布。`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {inspectedDurableRole?.status !== 'active' && onPublishRole ? (
                <button
                  type="button"
                  onClick={onPublishRole}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800"
                >
                  发布
                </button>
              ) : null}
              {inspectedDurableRole?.status === 'active' && onArchiveRole ? (
                <button
                  type="button"
                  onClick={onArchiveRole}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  归档
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          <main className="min-h-0 h-full overflow-y-auto pr-1">
            <div className="space-y-4">
              <SectionCard title="你现在就在编辑角色设定" description="从上到下依次填写：名称与简介 → 适用任务 → 长期规则 → 自动处理方式。">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[12px] text-slate-500">绑定角色</div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-900">{inspectedAgentInfo.name}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[12px] text-slate-500">当前状态</div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-900">{statusMeta.label}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[12px] text-slate-500">版本</div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-900">
                        {inspectedDurableRole ? `v${inspectedDurableRole.version}` : '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-[12px] text-slate-500">标签</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(inspectedDurableRole?.tags || toLines(roleEntityDraft?.tagsText.replace(/,/g, '\n'))).length > 0 ? (
                          (inspectedDurableRole?.tags || toLines(roleEntityDraft?.tagsText.replace(/,/g, '\n'))).slice(0, 4).map((tag) => (
                            <TonePill key={tag}>{tag}</TonePill>
                          ))
                        ) : (
                          <TonePill>暂无标签</TonePill>
                        )}
                      </div>
                    </div>
                  </div>
                  {inspectedLatestRoleDraft ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 lg:max-w-[320px]">
                      <div className="text-[13px] font-semibold text-slate-900">最近建议</div>
                      <div className="mt-1 text-[12px] leading-5 text-slate-500">
                        如果这条建议合适，可以直接采用，不用手动重填。
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={onApplyLatestRoleDraft}
                          className="rounded-full bg-slate-900 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          直接采用
                        </button>
                        <button
                          type="button"
                          onClick={onClearLatestRoleDraft}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          清空建议
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              {roleEntityDraft ? (
                <>
                  <SectionCard title="1. 基础信息" description="这里就是角色最核心的设定，先把名称、标签、头像和简介写清楚。">
                    <div className="grid gap-4">
                      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <FieldBlock label="角色头像" hint="上传或生成后会跟随角色一起保存。">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-[30px] shadow-sm">
                                {roleEntityDraft.avatarUrl ? (
                                  <img
                                    src={roleEntityDraft.avatarUrl}
                                    alt={roleEntityDraft.title || `${inspectedAgentInfo.name} 角色头像`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{inspectedAgentInfo.avatar}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-slate-900">
                                  {roleEntityDraft.avatarUrl ? '已设置角色头像' : '当前使用默认专家图标'}
                                </div>
                                <div className="mt-1 text-[12px] leading-5 text-slate-500">
                                  AI 生成会使用当前默认图片模型 {avatarGenerationModelLabel}。
                                </div>
                              </div>
                            </div>

                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAvatarFileChange}
                            />

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={avatarUploading || avatarGenerating || !isAvatarUploadAvailable}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Camera size={12} />
                                {avatarUploading ? '上传中...' : '上传头像'}
                              </button>
                              <button
                                type="button"
                                onClick={handleGenerateAvatar}
                                disabled={avatarUploading || avatarGenerating}
                                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {avatarGenerating ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Sparkles size={12} />
                                )}
                                {avatarGenerating ? '生成中...' : 'AI 生成头像'}
                              </button>
                              {roleEntityDraft.avatarUrl ? (
                                <button
                                  type="button"
                                  onClick={handleRemoveAvatar}
                                  disabled={avatarUploading || avatarGenerating}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Trash2 size={12} />
                                  移除
                                </button>
                              ) : null}
                            </div>

                            <div
                              className={`rounded-2xl border px-3.5 py-3 text-[12px] leading-5 ${
                                avatarError
                                  ? 'border-red-100 bg-red-50 text-red-600'
                                  : avatarStatus
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                    : isAvatarUploadAvailable
                                      ? 'border-slate-200 bg-slate-50 text-slate-500'
                                      : 'border-amber-100 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {avatarError ||
                                avatarStatus ||
                                (isAvatarUploadAvailable
                                  ? '上传头像需要可用图床；生成头像后会直接写入当前角色草稿。'
                                  : '当前未开启图床配置，上传入口已禁用；你仍可直接使用 AI 生成头像。')}
                            </div>
                          </div>
                        </FieldBlock>

                        <div className="grid gap-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FieldBlock label="角色名称" hint="名称要短，直接说清它负责什么。">
                              <input
                                type="text"
                                value={roleEntityDraft.title}
                                onChange={(event) => onRoleEntityDraftChange?.({ title: event.target.value })}
                                placeholder="例如：商品视觉策略师"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                              />
                            </FieldBlock>
                            <FieldBlock label="标签" hint="方便后续筛选，3 个左右就够。">
                              <input
                                type="text"
                                value={roleEntityDraft.tagsText}
                                onChange={(event) =>
                                  onRoleEntityDraftChange?.({ tagsText: event.target.value })
                                }
                                placeholder="例如：电商，视觉，策略"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                              />
                            </FieldBlock>
                          </div>

                          <FieldBlock label="一句话简介" hint="让人一眼看懂这个角色长期适合做什么。">
                            <textarea
                              value={roleEntityDraft.summary}
                              onChange={(event) => onRoleEntityDraftChange?.({ summary: event.target.value })}
                              placeholder="例如：负责商品图方向判断、镜头分工和视觉策略整理。"
                              className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                            />
                          </FieldBlock>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="2. 这个角色适合做什么" description="只写用户能直接看懂的使用场景和不适用场景。">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <FieldBlock label="适合什么任务" hint="一行一条，直接写使用场景。">
                        <textarea
                          value={roleEntityDraft.useWhenText}
                          onChange={(event) =>
                            onRoleEntityDraftChange?.({ useWhenText: event.target.value })
                          }
                          placeholder="例如：需要统一商品图策略"
                          className="min-h-[132px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                        />
                      </FieldBlock>
                      <FieldBlock label="不适合什么任务" hint="帮助用户避免选错角色。">
                        <textarea
                          value={roleEntityDraft.avoidWhenText}
                          onChange={(event) =>
                            onRoleEntityDraftChange?.({ avoidWhenText: event.target.value })
                          }
                          placeholder="例如：只需临时改一句文案"
                          className="min-h-[132px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                        />
                      </FieldBlock>
                    </div>
                  </SectionCard>

                  <SectionCard title="3. 长期规则" description="这里写长期有效的做事方式，不写这一次任务的临时要求。">
                    <FieldBlock
                      label="长期规则内容"
                      hint="例如：先确认是否保留旧链路；能删旧实现就删，不能删就说明原因。"
                    >
                      <textarea
                        value={roleEntityDraft.durableRoleAddon}
                        onChange={(event) =>
                          onRoleEntityDraftChange?.({ durableRoleAddon: event.target.value })
                        }
                        placeholder="写长期规则，不要写一次性的当前任务要求。"
                        className="min-h-[180px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                      />
                    </FieldBlock>
                  </SectionCard>

                  <SectionCard title="4. 自动处理方式" description="最后再决定主脑能不能自动改这个角色。">
                    <div className="space-y-5">
                      <div>
                        <div className="text-[14px] font-semibold text-slate-900">默认处理方式</div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500">
                          只保留一种默认方式，避免规则互相打架。
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {ROLE_GOVERNANCE_MODE_OPTIONS.map((option) => {
                            const active = roleEntityDraft.governanceMode === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  onRoleEntityDraftChange?.({ governanceMode: option.value })
                                }
                                className={[
                                  'rounded-2xl border px-4 py-3 text-left transition',
                                  active
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white',
                                ].join(' ')}
                              >
                                <div className="text-[13px] font-semibold">{option.label}</div>
                                <div className={[
                                  'mt-1 text-[12px] leading-5',
                                  active ? 'text-slate-200' : 'text-slate-500',
                                ].join(' ')}>
                                  {option.description}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[14px] font-semibold text-slate-900">允许主脑自动做什么</div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500">
                          这里只保留最关键的 3 项开关。
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {[
                            {
                              key: 'allowMainBrainMutation' as const,
                              label: '自动修改',
                              value: roleEntityDraft.allowMainBrainMutation,
                            },
                            {
                              key: 'allowMainBrainPromotion' as const,
                              label: '自动升级',
                              value: roleEntityDraft.allowMainBrainPromotion,
                            },
                            {
                              key: 'allowMainBrainArchive' as const,
                              label: '自动归档',
                              value: roleEntityDraft.allowMainBrainArchive,
                            },
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
                                onRoleEntityDraftChange?.({ [item.key]: !item.value })
                              }
                              className={[
                                'rounded-2xl border px-4 py-3 text-left transition',
                                item.value
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white',
                              ].join(' ')}
                            >
                              <div className="text-[13px] font-semibold">{item.label}</div>
                              <div className="mt-1 text-[12px] leading-5">
                                {item.value ? '已开启' : '已关闭'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <div className="text-[12px] leading-5 text-slate-500">
                          保存后会更新正式角色，并自动留下版本记录。
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={onResetRoleEntityDraft}
                            disabled={!roleEntityDirty}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[12px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <RotateCcw size={12} />
                            重置
                          </button>
                          <button
                            type="button"
                            onClick={onSaveRoleEntity}
                            disabled={!roleEntityCanSubmit || !roleEntityDirty}
                            className="rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {inspectedDurableRole ? '保存角色' : '创建角色'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="补充说明" description="这部分选填。只有你觉得前面的设定还不够时，再补充长期习惯。">
                    <textarea
                      value={roleInspectorDraft}
                      onChange={(event) => onDraftChange(event.target.value)}
                      placeholder="例如：改动前先确认是否保留旧链路；需要结论先行；不轻易回退到旧方案。"
                      className="min-h-[180px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[12px] leading-5 text-slate-500">
                        保存后会作为这个角色的长期补充规则参与后续任务。
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={onResetPromptAddon}
                          disabled={!inspectedHasAddon && !roleInspectorDraft.trim()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[12px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw size={12} />
                          清空
                        </button>
                        <button
                          type="button"
                          onClick={onSavePromptAddon}
                          disabled={!inspectedPromptDirty}
                          className="rounded-full bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          保存补充规则
                        </button>
                      </div>
                    </div>
                  </SectionCard>

                  {inspectedDurableRole ? (
                    <SectionCard title="最近变更" description="这一块只用来回看历史，不参与当前编辑。">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="space-y-3">
                          <div className="text-[13px] font-semibold text-slate-900">版本</div>
                          {inspectedRoleVersions.length > 0 ? (
                            inspectedRoleVersions.slice(0, 3).map((version) => (
                              <div key={version.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900">v{version.version}</div>
                                    <div className="text-[12px] text-slate-500">{version.changeType}</div>
                                  </div>
                                  <div className="text-right text-[11px] leading-5 text-slate-400">
                                    {formatTime(version.createdAt)}
                                  </div>
                                </div>
                                <div className="mt-2 text-[12px] leading-5 text-slate-600">
                                  {version.summary || '当前没有版本说明。'}
                                </div>
                                {onRollbackRoleVersion && inspectedDurableRole.version !== version.version ? (
                                  <button
                                    type="button"
                                    onClick={() => onRollbackRoleVersion(version.version)}
                                    className="mt-3 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                  >
                                    回滚到这个版本
                                  </button>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-500">
                              还没有版本记录。
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="text-[13px] font-semibold text-slate-900">最近记录</div>
                          {inspectedRoleAuditEntries.length > 0 ? (
                            inspectedRoleAuditEntries.slice(0, 4).map((entry) => (
                              <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="font-medium text-slate-900">{entry.summary}</div>
                                  <div className="text-right text-[11px] leading-5 text-slate-400">
                                    {formatTime(entry.createdAt)}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-500">
                              还没有最近记录。
                            </div>
                          )}
                        </div>
                      </div>
                    </SectionCard>
                  ) : null}

                  <SectionCard title="高级查看" description="这部分不是编辑入口，只给排查时使用。">
                    <div className="space-y-3">
                      <details className="group rounded-2xl bg-slate-50 px-4 py-3">
                        <summary className="cursor-pointer list-none text-[13px] font-medium text-slate-900">
                          查看系统原始内容
                        </summary>
                        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-600">
                          {inspectedBuiltInPrompt}
                        </pre>
                      </details>
                      <details className="group rounded-2xl bg-slate-50 px-4 py-3">
                        <summary className="cursor-pointer list-none text-[13px] font-medium text-slate-900">
                          查看主脑共享规则
                        </summary>
                        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-600">
                          {inspectedMainBrainBlock || '当前没有额外共享规则。'}
                        </pre>
                      </details>
                      <details className="group rounded-2xl bg-slate-50 px-4 py-3">
                        <summary className="cursor-pointer list-none text-[13px] font-medium text-slate-900">
                          查看当前组合结果
                        </summary>
                        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-600">
                          {previewPrompt}
                        </pre>
                      </details>
                    </div>
                  </SectionCard>
                </>
              ) : (
                <SectionCard title="基础信息" description="当前没有可编辑内容。">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-[13px] leading-6 text-slate-500">
                    这里暂时没有可修改的正式角色内容。
                  </div>
                </SectionCard>
              )}
            </div>
          </main>

        </div>
      </div>
    </div>
  );
};
