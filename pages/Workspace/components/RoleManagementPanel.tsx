import React from 'react';
import { RotateCcw, X } from 'lucide-react';
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

type RoleEntityEditorDraft = {
  title: string;
  summary: string;
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
    description: '主脑只能读取与绑定，不允许主动生成或改写。',
  },
  {
    value: 'draft_only',
    label: '仅允许出草案',
    description: '允许主脑产出候选草案，但升级与落库必须人工确认。',
  },
  {
    value: 'approval_required',
    label: '变更需审批',
    description: '适合正式长期角色，允许治理建议但必须人工批准。',
  },
  {
    value: 'auto_manage',
    label: '允许自动治理',
    description: '适合高频试验角色，允许主脑直接维护发布流。',
  },
];

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

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 p-4">
      <button
        type="button"
        aria-label="close role inspector"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-[141] flex max-h-[min(88vh,920px)] w-[min(980px,100%)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl leading-none">{inspectedAgentInfo.avatar}</span>
              <h3 className="text-[18px] font-bold text-slate-900">
                {inspectedDurableRole ? inspectedDurableRole.title : `${inspectedAgentInfo.name} 角色提示词`}
              </h3>
              {inspectedDurableRole ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  {inspectedDurableRole.status === 'active'
                    ? '长期角色'
                    : inspectedDurableRole.status === 'archived'
                      ? '已归档角色'
                      : '角色草案'}
                </span>
              ) : (
                inspectedHasAddon && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
                    已启用自定义补充
                  </span>
                )
              )}
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-500">
              {inspectedDurableRole
                ? `这是一个可持久化的角色实体，当前绑定到 ${inspectedAgentInfo.name} 专家壳。你可以在这里查看治理模式、版本历史，以及它与专家壳提示词的关系。`
                : '这里可以查看角色内置提示词，运行时会在其后叠加你的长期补充规则，方便保持角色边界清晰稳定。'}
            </p>
            {(roleId || roleId === null) && (
              <div className="mt-2 text-[11px] leading-5 text-slate-400">
                {roleId ? `角色实体 ID：${roleId}` : '当前未绑定 durable role。'}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-6 py-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex min-h-0 flex-col gap-4">
            {inspectedDurableRole && (
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    长期角色实体
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    这是用户资产层里的 durable role，不等同于右侧专家壳补充层；右侧编辑不会直接改写这里的实体版本。
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  <div>
                    <div className="font-semibold text-slate-900">摘要</div>
                    <div className="mt-1 text-slate-600">
                      {inspectedDurableRole.summary || '当前没有摘要。'}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="font-semibold text-slate-900">角色 ID</div>
                      <div className="mt-1 break-all text-slate-600">{inspectedDurableRole.id}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">绑定专家壳</div>
                      <div className="mt-1 text-slate-600">{inspectedAgentInfo.name}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      来源 {inspectedDurableRole.source}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      状态 {inspectedDurableRole.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      治理 {inspectedDurableRole.governance.mode}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      版本 v{inspectedDurableRole.version}
                    </span>
                    {selectedRoleId === inspectedDurableRole.id && (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                        当前会话已绑定
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">治理权限</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        变更 {inspectedDurableRole.governance.allowMainBrainMutation ? '允许' : '禁止'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        升级 {inspectedDurableRole.governance.allowMainBrainPromotion ? '允许' : '禁止'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        归档 {inspectedDurableRole.governance.allowMainBrainArchive ? '允许' : '禁止'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">发布与治理动作</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {inspectedDurableRole.status !== 'active' && onPublishRole ? (
                        <button
                          type="button"
                          onClick={onPublishRole}
                          className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          发布角色
                        </button>
                      ) : null}
                      {inspectedDurableRole.status === 'active' && onArchiveRole ? (
                        <button
                          type="button"
                          onClick={onArchiveRole}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          归档角色
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-slate-400">
                      发布会把当前角色切到长期可用状态；归档后不会再作为默认活动角色参与常规选择。
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">长期附加层</div>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 px-4 py-3 text-[11px] leading-6 text-slate-600">
                      {inspectedDurableRole.promptLayers.durableRoleAddon || '当前没有 durable role addon。'}
                    </pre>
                  </div>
                </div>
              </section>
            )}

            {roleEntityDraft && (
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {inspectedDurableRole ? '角色实体编辑' : '创建正式角色'}
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    {inspectedDurableRole
                      ? '这里编辑的是 durable role 实体本身，用于补齐标题、摘要、适用边界与治理权限。'
                      : '当你还没有 durable role 时，可以直接在这里创建一张正式角色卡，而不是只停留在补充层。'}
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <div className="font-semibold text-slate-900">角色标题</div>
                      <input
                        type="text"
                        value={roleEntityDraft.title}
                        onChange={(event) => onRoleEntityDraftChange?.({ title: event.target.value })}
                        placeholder="例如：商品视觉策略师"
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                      />
                    </label>
                    <label className="block min-w-0">
                      <div className="font-semibold text-slate-900">角色标签</div>
                      <input
                        type="text"
                        value={roleEntityDraft.tagsText}
                        onChange={(event) =>
                          onRoleEntityDraftChange?.({ tagsText: event.target.value })
                        }
                        placeholder="用逗号分隔，例如：电商,视觉,策略"
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                      />
                    </label>
                  </div>

                  <label className="block min-w-0">
                    <div className="font-semibold text-slate-900">角色摘要</div>
                    <textarea
                      value={roleEntityDraft.summary}
                      onChange={(event) => onRoleEntityDraftChange?.({ summary: event.target.value })}
                      placeholder="一句话说明这个角色长期负责什么、适合什么任务。"
                      className="mt-2 min-h-[92px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block min-w-0">
                      <div className="font-semibold text-slate-900">适用场景</div>
                      <textarea
                        value={roleEntityDraft.useWhenText}
                        onChange={(event) =>
                          onRoleEntityDraftChange?.({ useWhenText: event.target.value })
                        }
                        placeholder="一行一条，例如：需要统一商品图策略"
                        className="mt-2 min-h-[112px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                      />
                    </label>
                    <label className="block min-w-0">
                      <div className="font-semibold text-slate-900">不适用场景</div>
                      <textarea
                        value={roleEntityDraft.avoidWhenText}
                        onChange={(event) =>
                          onRoleEntityDraftChange?.({ avoidWhenText: event.target.value })
                        }
                        placeholder="一行一条，例如：只需一次性微调文案措辞"
                        className="mt-2 min-h-[112px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                      />
                    </label>
                  </div>

                  <label className="block min-w-0">
                    <div className="font-semibold text-slate-900">长期角色附加层</div>
                    <textarea
                      value={roleEntityDraft.durableRoleAddon}
                      onChange={(event) =>
                        onRoleEntityDraftChange?.({ durableRoleAddon: event.target.value })
                      }
                      placeholder="填写 durable role 自己的长期规则；它会与内置基线和主脑共享层一起组成实体快照。"
                      className="mt-2 min-h-[148px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                    />
                  </label>

                  <div>
                    <div className="font-semibold text-slate-900">治理模式</div>
                    <div className="mt-2 grid gap-3 lg:grid-cols-2">
                      {ROLE_GOVERNANCE_MODE_OPTIONS.map((option) => {
                        const active = roleEntityDraft.governanceMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              onRoleEntityDraftChange?.({ governanceMode: option.value })
                            }
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              active
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <div className="text-[12px] font-semibold">{option.label}</div>
                            <div
                              className={`mt-1 text-[11px] leading-5 ${
                                active ? 'text-slate-200' : 'text-slate-500'
                              }`}
                            >
                              {option.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">主脑治理权限</div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          key: 'allowMainBrainMutation' as const,
                          label: '允许直接变更',
                          value: roleEntityDraft.allowMainBrainMutation,
                        },
                        {
                          key: 'allowMainBrainPromotion' as const,
                          label: '允许直接升级',
                          value: roleEntityDraft.allowMainBrainPromotion,
                        },
                        {
                          key: 'allowMainBrainArchive' as const,
                          label: '允许直接归档',
                          value: roleEntityDraft.allowMainBrainArchive,
                        },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            onRoleEntityDraftChange?.({ [item.key]: !item.value })
                          }
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            item.value
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className="text-[12px] font-semibold">{item.label}</div>
                          <div className="mt-1 text-[11px] leading-5">
                            {item.value ? '当前开启' : '当前关闭'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="text-[11px] leading-5 text-slate-400">
                      保存后会写入 durable role 实体，并生成新版本记录；标题、摘要与长文本都已按资产层规范自动裁剪。
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onResetRoleEntityDraft}
                        disabled={!roleEntityDirty}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RotateCcw size={12} />
                        重置表单
                      </button>
                      <button
                        type="button"
                        onClick={onSaveRoleEntity}
                        disabled={!roleEntityCanSubmit || !roleEntityDirty}
                        className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {inspectedDurableRole ? '保存角色实体' : '创建正式角色'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {inspectedRoleProfile && (
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    角色适配说明
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    用来判断这个角色该直接复用、临时增强，还是替换成新的任务型角色。
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  <div>
                    <div className="font-semibold text-slate-900">用途</div>
                    <div className="mt-1 text-slate-600">{inspectedRoleProfile.purpose}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">适用场景</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                      {inspectedRoleProfile.useWhen.map((item) => (
                        <li key={`use-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">不适用场景</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                      {inspectedRoleProfile.avoidWhen.map((item) => (
                        <li key={`avoid-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">需要调整时机</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                      {inspectedRoleProfile.adaptWhen.map((item) => (
                        <li key={`adapt-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">动态角色策略</div>
                    <div className="mt-1 text-slate-600">{inspectedRoleProfile.dynamicRolePolicy}</div>
                  </div>
                </div>
              </section>
            )}

            {inspectedLatestRoleDraft && (
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    最近自动草案
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    这是自动角色最近一次为该专家角色生成的临时草案。
                  </p>
                </div>
                <div className="space-y-4 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  <div>
                    <div className="font-semibold text-slate-900">策略</div>
                    <div className="mt-1 text-slate-600">
                      {inspectedLatestRoleDraft.roleStrategy || 'reuse'}
                    </div>
                  </div>
                  {inspectedLatestRoleDraft.roleStrategyReason && (
                    <div>
                      <div className="font-semibold text-slate-900">原因</div>
                      <div className="mt-1 text-slate-600">
                        {inspectedLatestRoleDraft.roleStrategyReason}
                      </div>
                    </div>
                  )}
                  {inspectedLatestRoleDraft.title && (
                    <div>
                      <div className="font-semibold text-slate-900">标题</div>
                      <div className="mt-1 text-slate-600">{inspectedLatestRoleDraft.title}</div>
                    </div>
                  )}
                  {inspectedLatestRoleDraft.summary && (
                    <div>
                      <div className="font-semibold text-slate-900">摘要</div>
                      <div className="mt-1 text-slate-600">{inspectedLatestRoleDraft.summary}</div>
                    </div>
                  )}
                  {inspectedLatestRoleDraft.instructions.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-900">指令</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                        {inspectedLatestRoleDraft.instructions.map((item) => (
                          <li key={`draft-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onApplyLatestRoleDraft}
                      className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                    >
                      应用到补充层
                    </button>
                    <button
                      type="button"
                      onClick={onSaveLatestRoleDraftAsFormalRole}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      保存为正式角色
                    </button>
                    <button
                      type="button"
                      onClick={onClearLatestRoleDraft}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      清空自动草案
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-slate-50/60">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  内置提示词
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  这是系统内置的角色定义，包含行为风格、工具约束和回复规则。
                </p>
              </div>
              <pre className="min-h-[280px] flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 text-[12px] leading-6 text-slate-700">
                {inspectedBuiltInPrompt}
              </pre>
            </section>

            <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-slate-50/60">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  主脑全局层
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  这层是主脑共享的长期规则，会先于角色自己的用户补充层注入。
                </p>
              </div>
              <pre className="min-h-[180px] flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 text-[12px] leading-6 text-slate-700">
                {inspectedMainBrainBlock || '当前没有额外的主脑长期偏好，只有系统基础规则在生效。'}
              </pre>
            </section>
          </div>

          <div className="flex min-h-0 flex-col gap-4">
            {inspectedDurableRole && (
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    版本记录
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    展示该 durable role 最近的版本变化，便于后续继续接入审计和回滚入口。
                  </p>
                </div>
                <div className="space-y-3 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  {inspectedRoleVersions.length > 0 ? (
                    inspectedRoleVersions.slice(0, 6).map((version) => (
                      <div
                        key={version.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">
                            v{version.version} · {version.changeType}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[11px] text-slate-400">
                              {new Date(version.createdAt).toLocaleString('zh-CN')}
                            </div>
                            {onRollbackRoleVersion && inspectedDurableRole?.version !== version.version ? (
                              <button
                                type="button"
                                onClick={() => onRollbackRoleVersion(version.version)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                回滚到此版本
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-1 text-slate-600">{version.summary}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-slate-500">
                      当前角色还没有可显示的版本记录。
                    </div>
                  )}
                </div>
              </section>
            )}

            {inspectedDurableRole && (
              <section className="rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    审计记录
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    这里显示角色实体相关的最近资产审计，便于确认发布、升级、回滚和归档动作。
                  </p>
                </div>
                <div className="space-y-3 px-5 py-4 text-[12px] leading-6 text-slate-700">
                  {inspectedRoleAuditEntries.length > 0 ? (
                    inspectedRoleAuditEntries.slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">
                            {entry.action} · {entry.targetKind}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(entry.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <div className="mt-1 text-slate-600">{entry.summary}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-slate-500">
                      当前角色还没有可显示的审计记录。
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  自定义补充规则
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  这里写角色自己的长期补充规则，比如清理旧链路、避免回退、沟通风格约束等。
                </p>
              </div>
              <div className="px-5 py-4">
                <textarea
                  value={roleInspectorDraft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  placeholder="例如：改动前先确认是否回退到旧模块；能删旧链路就删，不能删就说明保留原因和替代关系。"
                  className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] leading-5 text-slate-400">
                    这里保存的是角色长期层；具体任务执行时仍然可以额外叠加临时角色覆盖。
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onResetPromptAddon}
                      disabled={!inspectedHasAddon && !roleInspectorDraft.trim()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw size={12} />
                      清空补充
                    </button>
                    <button
                      type="button"
                      onClick={onSavePromptAddon}
                      disabled={!inspectedPromptDirty}
                      className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      保存补充
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-slate-50/60">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  最终提示词预览
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  预览顺序是内置基线、主脑长期层、角色长期补充层；临时任务覆盖只会在执行时追加。
                </p>
              </div>
              <pre className="min-h-[180px] flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 text-[12px] leading-6 text-slate-700">
                {roleInspectorDraft.trim()
                  ? [
                      inspectedBuiltInPrompt,
                      inspectedMainBrainBlock,
                      buildUserCustomRoleAddonBlock(roleInspectorDraft.trim()),
                    ]
                      .filter(Boolean)
                      .join('\n\n')
                  : inspectedEffectivePrompt}
              </pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
