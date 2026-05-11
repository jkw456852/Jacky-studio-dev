import React from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock3,
  Compass,
  Lightbulb,
  Route,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';
import type { StudioUserAssetApi } from '../../../services/runtime-assets/api';
import { getMainBrainPreferenceBlock } from '../../../services/runtime-assets/main-brain';
import type {
  StudioMainBrainAnalysisDepth,
  StudioMainBrainBootstrapAsset,
  StudioMainBrainHeartbeatAsset,
  StudioMainBrainHeartbeatCadence,
  StudioMainBrainHeartbeatTask,
  StudioMainBrainHeartbeatTaskType,
  StudioMainBrainSearchPolicy,
  StudioMainBrainSoulAsset,
  StudioMainBrainUserAsset,
  StudioMainBrainWorkflowAsset,
  StudioMainBrainWorkflowRoleGovernanceDefaults,
} from '../../../services/runtime-assets/user-asset-types';

type MainBrainSectionId = 'overview' | 'soul' | 'user' | 'workflow' | 'memory' | 'heartbeat' | 'bootstrap';

type MainBrainConfigCenterProps = {
  onClose: () => void;
  userAssetApi: StudioUserAssetApi;
  revision: number;
  onSaved: () => void;
  legacyPreferenceDraft: string;
  legacyPreferenceDirty: boolean;
  legacyPreferenceDefaultText: string;
  legacyPreferenceStoredCount: number;
  onLegacyPreferenceDraftChange: (value: string) => void;
  onSaveLegacyPreferences: () => void;
  onResetLegacyPreferences: () => void;
};

type SoulDraft = {
  persona: string;
  toneText: string;
  workingStyleText: string;
  restraintRulesText: string;
  selfCheckRulesText: string;
  riskPreference: StudioMainBrainSoulAsset['riskPreference'];
};

type UserDraft = {
  goalsText: string;
  workingHabitsText: string;
  businessContextText: string;
  aestheticPreferencesText: string;
  communicationStyleText: string;
  permanentNotesText: string;
  memoryBlacklistText: string;
};

type WorkflowDraft = {
  defaultAnalysisDepth: StudioMainBrainAnalysisDepth;
  searchPolicy: StudioMainBrainSearchPolicy;
  clarifyBeforeExecution: boolean;
  toolUseGuidelinesText: string;
  failureRecoveryRulesText: string;
  governanceMode: StudioMainBrainWorkflowRoleGovernanceDefaults['mode'];
  allowDraft: boolean;
  allowAutoPromote: boolean;
  allowAutoArchive: boolean;
};

type BootstrapCollaborationMode = 'advisor' | 'executor' | 'research_partner';
type BootstrapResponseStyle = 'conclusion_first' | 'analysis_first';

type BootstrapDraft = {
  collaborationMode: BootstrapCollaborationMode;
  responseStyle: BootstrapResponseStyle;
  searchPolicy: StudioMainBrainSearchPolicy;
  allowRoleDrafts: boolean;
  allowHeartbeat: boolean;
  projectTypesText: string;
};

type MemoryFilterId = 'pending' | 'active' | 'recent';

type HeartbeatDraft = {
  enabled: boolean;
  cadence: StudioMainBrainHeartbeatCadence;
  scopeText: string;
  recentRunSummaryText: string;
};

type HeartbeatTaskDraft = {
  id: string;
  type: StudioMainBrainHeartbeatTaskType;
  title: string;
  enabled: boolean;
  cadence: StudioMainBrainHeartbeatCadence;
  scopeText: string;
  lastSummary: string;
};

type NavItem = {
  id: MainBrainSectionId;
  title: string;
  caption: string;
  icon: React.ElementType;
};

const PRIMARY_SECTIONS: NavItem[] = [
  {
    id: 'overview',
    title: 'Overview',
    caption: '状态摘要与待处理提醒',
    icon: Compass,
  },
  {
    id: 'bootstrap',
    title: 'Bootstrap',
    caption: '首次初始化问卷与默认值落库',
    icon: Sparkles,
  },
  {
    id: 'soul',
    title: 'Soul',
    caption: '人格、风格、克制与风险偏好',
    icon: Brain,
  },
  {
    id: 'user',
    title: 'User',
    caption: '用户目标、习惯、背景与偏好',
    icon: UserRound,
  },
  {
    id: 'workflow',
    title: 'Workflow',
    caption: '默认做事方式与治理策略',
    icon: Workflow,
  },
  {
    id: 'memory',
    title: 'Memory',
    caption: '待确认记忆、长期记忆与每日摘要',
    icon: Activity,
  },
  {
    id: 'heartbeat',
    title: 'Heartbeat',
    caption: '低频整理任务、频率边界与最近摘要',
    icon: Clock3,
  },
];

const FUTURE_SECTIONS = ['Audit · 待后续实现'] as const;

const MEMORY_FILTERS: Array<{
  id: MemoryFilterId;
  title: string;
  caption: string;
}> = [
  {
    id: 'pending',
    title: '待确认',
    caption: '需要人工判断是否进入长期记忆。',
  },
  {
    id: 'active',
    title: '已确认',
    caption: '已进入运行时摘要的长期记忆。',
  },
  {
    id: 'recent',
    title: '最近提炼',
    caption: '按最近更新时间查看最新记忆变化。',
  },
];

const MEMORY_CATEGORY_LABELS: Record<string, string> = {
  preference: '长期偏好',
  background: '背景信息',
  aesthetic: '审美偏好',
  boundary: '边界规则',
  project_fact: '项目事实',
  workflow: '工作流',
  governance: '治理偏好',
};

const MEMORY_SOURCE_LABELS: Record<string, string> = {
  conversation: '会话提炼',
  user_explicit: '用户明确输入',
  task_summary: '任务总结',
  heartbeat: 'Heartbeat',
  manual: '手动维护',
};

const MEMORY_STATUS_META: Record<string, { label: string; tone: 'slate' | 'amber' | 'blue' }> = {
  candidate: { label: '待确认', tone: 'amber' },
  active: { label: '已确认', tone: 'blue' },
  dismissed: { label: '已忽略', tone: 'slate' },
};

const HEARTBEAT_TASK_TYPE_LABELS: Record<StudioMainBrainHeartbeatTaskType, string> = {
  preference_compaction: '偏好压缩',
  failure_summary: '失败总结',
  memory_review_reminder: '记忆确认提醒',
  role_staleness_check: '角色陈旧检查',
  rule_conflict_check: '规则冲突检查',
};

const HEARTBEAT_TASK_TEMPLATES: Array<{
  type: StudioMainBrainHeartbeatTaskType;
  title: string;
  desc: string;
  defaultSummary: string;
}> = [
  {
    type: 'preference_compaction',
    title: '压缩最近高频偏好',
    desc: '用于整理重复出现的长期偏好，避免规则层越堆越散。',
    defaultSummary: '最近暂无新的偏好压缩结果。',
  },
  {
    type: 'failure_summary',
    title: '汇总最近失败原因',
    desc: '低频整理最近失败模式，用于帮助主脑识别高频问题。',
    defaultSummary: '最近暂无新的失败模式摘要。',
  },
  {
    type: 'memory_review_reminder',
    title: '提醒确认待提升记忆',
    desc: '定期提醒用户处理待确认记忆，避免候选区持续堆积。',
    defaultSummary: '当前没有需要额外提醒确认的记忆。',
  },
  {
    type: 'role_staleness_check',
    title: '检查长期角色是否陈旧',
    desc: '提醒哪些长期角色长期未使用，但不直接做高风险修改。',
    defaultSummary: '当前暂无长期未使用的角色提醒。',
  },
  {
    type: 'rule_conflict_check',
    title: '检查默认规则冲突',
    desc: '用于发现 Soul / Workflow / Memory 之间的明显冲突。',
    defaultSummary: '当前暂无明显的长期规则冲突。',
  },
];

const BOOTSTRAP_SOURCE_PREFIX = 'bootstrap-questionnaire-v1';

const extractPrefixedValue = (items: string[], prefixes: string[]): string => {
  for (const item of items) {
    for (const prefix of prefixes) {
      if (item.startsWith(prefix)) {
        return item.slice(prefix.length).trim();
      }
    }
  }
  return '';
};

const inferBootstrapCollaborationMode = (soulAsset: StudioMainBrainSoulAsset): BootstrapCollaborationMode => {
  const persona = `${soulAsset.persona} ${soulAsset.workingStyle.join(' ')}`;
  if (persona.includes('研究')) return 'research_partner';
  if (persona.includes('执行')) return 'executor';
  return 'advisor';
};

const inferBootstrapResponseStyle = (
  soulAsset: StudioMainBrainSoulAsset,
  userAsset: StudioMainBrainUserAsset,
): BootstrapResponseStyle => {
  const text = [...soulAsset.tone, ...userAsset.communicationStyle].join(' ');
  if (text.includes('先展开分析') || text.includes('分析先行')) return 'analysis_first';
  return 'conclusion_first';
};

const parseBootstrapSourceTemplate = (value: string): Partial<BootstrapDraft> => {
  const [prefix, collaborationMode, responseStyle, searchPolicy, roleDraftFlag, heartbeatFlag] =
    value.split('|');
  if (prefix !== BOOTSTRAP_SOURCE_PREFIX) return {};
  return {
    collaborationMode:
      collaborationMode === 'advisor' ||
      collaborationMode === 'executor' ||
      collaborationMode === 'research_partner'
        ? collaborationMode
        : undefined,
    responseStyle:
      responseStyle === 'conclusion_first' || responseStyle === 'analysis_first'
        ? responseStyle
        : undefined,
    searchPolicy:
      searchPolicy === 'never' || searchPolicy === 'auto' || searchPolicy === 'prefer'
        ? searchPolicy
        : undefined,
    allowRoleDrafts: roleDraftFlag === 'draft:1' ? true : roleDraftFlag === 'draft:0' ? false : undefined,
    allowHeartbeat: heartbeatFlag === 'heartbeat:1' ? true : heartbeatFlag === 'heartbeat:0' ? false : undefined,
  };
};

const buildBootstrapDraft = (args: {
  bootstrapAsset: StudioMainBrainBootstrapAsset;
  soulAsset: StudioMainBrainSoulAsset;
  userAsset: StudioMainBrainUserAsset;
  workflowAsset: StudioMainBrainWorkflowAsset;
}): BootstrapDraft => {
  const parsed = parseBootstrapSourceTemplate(args.bootstrapAsset.sourceTemplate);
  const projectTypesText = extractPrefixedValue(
    [...args.userAsset.businessContext, ...args.userAsset.permanentNotes, ...args.userAsset.goals],
    ['常见项目类型：', '常见项目类型:', '项目类型：', '项目类型:'],
  );
  return {
    collaborationMode: parsed.collaborationMode || inferBootstrapCollaborationMode(args.soulAsset),
    responseStyle: parsed.responseStyle || inferBootstrapResponseStyle(args.soulAsset, args.userAsset),
    searchPolicy: parsed.searchPolicy || args.workflowAsset.searchPolicy,
    allowRoleDrafts:
      typeof parsed.allowRoleDrafts === 'boolean'
        ? parsed.allowRoleDrafts
        : args.workflowAsset.roleGovernanceDefaults.allowDraft,
    allowHeartbeat:
      typeof parsed.allowHeartbeat === 'boolean'
        ? parsed.allowHeartbeat
        : args.bootstrapAsset.completedSteps.includes('heartbeat-enabled'),
    projectTypesText,
  };
};

const buildBootstrapSourceTemplate = (draft: BootstrapDraft): string =>
  [
    BOOTSTRAP_SOURCE_PREFIX,
    draft.collaborationMode,
    draft.responseStyle,
    draft.searchPolicy,
    `draft:${draft.allowRoleDrafts ? 1 : 0}`,
    `heartbeat:${draft.allowHeartbeat ? 1 : 0}`,
  ].join('|');

const buildBootstrapDefaults = (draft: BootstrapDraft) => {
  const projectTypesText = draft.projectTypesText.trim() || '产品 / 工程协作类项目';
  const responseLine =
    draft.responseStyle === 'conclusion_first'
      ? '默认先给结论、判断与下一步，再按需展开分析。'
      : '默认先展开分析框架、依据与边界，再收敛为结论。';

  const collaborationMap: Record<
    BootstrapCollaborationMode,
    {
      persona: string;
      workingStyle: string[];
      riskPreference: StudioMainBrainSoulAsset['riskPreference'];
      defaultAnalysisDepth: StudioMainBrainAnalysisDepth;
      clarifyBeforeExecution: boolean;
    }
  > = {
    advisor: {
      persona: '冷静、克制、以判断和建议为先的顾问型主脑。',
      workingStyle: ['先明确目标和约束，再给可执行建议。', '优先识别风险、依赖与信息缺口。', '不伪装完成，必要时明确要求补充信息或验证。'],
      riskPreference: 'conservative',
      defaultAnalysisDepth: 'balanced',
      clarifyBeforeExecution: true,
    },
    executor: {
      persona: '可靠、克制、以推进和交付为先的执行型主脑。',
      workingStyle: ['先拆解任务与依赖，再推进执行。', '默认产出可落地的下一步与验证动作。', '遇到不确定项先标注边界，再继续收敛。'],
      riskPreference: 'balanced',
      defaultAnalysisDepth: 'balanced',
      clarifyBeforeExecution: false,
    },
    research_partner: {
      persona: '严谨、克制、以洞察、证据和框架为先的研究搭档型主脑。',
      workingStyle: ['先搭建分析框架，再补证据与对比。', '显式说明假设、边界和不确定性。', '在给出判断前先压实依据与推理链路。'],
      riskPreference: 'conservative',
      defaultAnalysisDepth: 'deep',
      clarifyBeforeExecution: true,
    },
  };

  const profile = collaborationMap[draft.collaborationMode];
  const roleGovernanceDefaults: StudioMainBrainWorkflowRoleGovernanceDefaults = draft.allowRoleDrafts
    ? {
        mode: 'approval_required',
        allowDraft: true,
        allowAutoPromote: false,
        allowAutoArchive: false,
      }
    : {
        mode: 'manual_only',
        allowDraft: false,
        allowAutoPromote: false,
        allowAutoArchive: false,
      };

  return {
    soul: {
      persona: profile.persona,
      tone: [responseLine, '表达直接、克制，避免空话与装饰性表述。', '重要风险、未验证项和依赖必须显式说明。'],
      workingStyle: profile.workingStyle,
      restraintRules: ['不要伪装已完成或已验证。', '信息不足时不要编造结论。', '不要把低置信度判断写成确定事实。'],
      selfCheckRules: ['输出前检查是否说明关键假设与风险。', '涉及实现时检查真实链路是否打通，而不只看构建结果。', '确认最终输出是否给出明确下一步。'],
      riskPreference: profile.riskPreference,
    },
    user: {
      goals: ['围绕用户的长期目标持续优化产品、协作流程与交付质量。'],
      workingHabits: ['默认先确认现状与链路，再做实现或结论输出。', '变更后优先验证真实闭环，不接受表面完成。'],
      businessContext: [`常见项目类型：${projectTypesText}`, '这是一个需要长期演进、强调真实可用性的产品级工作台。'],
      aestheticPreferences: ['界面应克制、专业、统一，避免 demo 感。', '优先保证信息层级、排版、留白、对齐与一致性。'],
      communicationStyle: [responseLine, '沟通以中文直达结论，必要时再补充分析过程。'],
      permanentNotes: [
        `Bootstrap 来源：${draft.collaborationMode} / ${draft.responseStyle} / 搜索 ${draft.searchPolicy}`,
        draft.allowHeartbeat
          ? '允许后续 Heartbeat 模块定期整理长期记忆。'
          : 'Heartbeat 默认保持关闭，后续需显式开启。',
      ],
    },
    workflow: {
      defaultAnalysisDepth: profile.defaultAnalysisDepth,
      searchPolicy: draft.searchPolicy,
      clarifyBeforeExecution: profile.clarifyBeforeExecution,
      toolUseGuidelines: [
        '先读上下文、再动手修改。',
        '变更后验证真实链路，不只以构建通过作为完成标准。',
        draft.searchPolicy === 'prefer' ? '外部信息不确定时优先联网补证。' : '是否联网由任务真实性和信息缺口决定。',
      ],
      failureRecoveryRules: ['失败先定位根因，再决定重试或回退。', '不要跳过错误直接宣称完成。', '必要时回到更小、更可验证的步骤重新推进。'],
      roleGovernanceDefaults,
    },
  };
};

const toLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const toText = (items: string[]): string => items.join('\n');

const normalizeDraftText = (value: string): string => toText(toLines(value));

const formatTime = (value: number | null | undefined): string => {
  if (!value || !Number.isFinite(value)) return '尚未保存';
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const summarizeList = (label: string, text: string, limit = 3): string[] => {
  const items = toLines(text);
  if (items.length === 0) return [];
  const visible = items.slice(0, limit);
  const suffix = items.length > limit ? `（+${items.length - limit}）` : '';
  return [`${label}：${visible.join('；')}${suffix}`];
};

const buildSoulDraft = (asset: StudioMainBrainSoulAsset): SoulDraft => ({
  persona: asset.persona,
  toneText: toText(asset.tone),
  workingStyleText: toText(asset.workingStyle),
  restraintRulesText: toText(asset.restraintRules),
  selfCheckRulesText: toText(asset.selfCheckRules),
  riskPreference: asset.riskPreference,
});

const buildUserDraft = (asset: StudioMainBrainUserAsset): UserDraft => ({
  goalsText: toText(asset.goals),
  workingHabitsText: toText(asset.workingHabits),
  businessContextText: toText(asset.businessContext),
  aestheticPreferencesText: toText(asset.aestheticPreferences),
  communicationStyleText: toText(asset.communicationStyle),
  permanentNotesText: toText(asset.permanentNotes),
  memoryBlacklistText: toText(asset.memoryBlacklist),
});

const buildWorkflowDraft = (asset: StudioMainBrainWorkflowAsset): WorkflowDraft => ({
  defaultAnalysisDepth: asset.defaultAnalysisDepth,
  searchPolicy: asset.searchPolicy,
  clarifyBeforeExecution: asset.clarifyBeforeExecution,
  toolUseGuidelinesText: toText(asset.toolUseGuidelines),
  failureRecoveryRulesText: toText(asset.failureRecoveryRules),
  governanceMode: asset.roleGovernanceDefaults.mode,
  allowDraft: asset.roleGovernanceDefaults.allowDraft,
  allowAutoPromote: asset.roleGovernanceDefaults.allowAutoPromote,
  allowAutoArchive: asset.roleGovernanceDefaults.allowAutoArchive,
});

const buildHeartbeatDraft = (asset: StudioMainBrainHeartbeatAsset): HeartbeatDraft => ({
  enabled: asset.enabled,
  cadence: asset.cadence,
  scopeText: toText(asset.scope),
  recentRunSummaryText: toText(asset.recentRunSummary),
});

const buildHeartbeatTaskDraft = (task: StudioMainBrainHeartbeatTask): HeartbeatTaskDraft => ({
  id: task.id,
  type: task.type,
  title: task.title,
  enabled: task.enabled,
  cadence: task.cadence,
  scopeText: toText(task.scope),
  lastSummary: task.lastSummary,
});

const SectionCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: 'white' | 'slate';
}> = ({ title, description, children, tone = 'white' }) => (
  <section
    className={[
      'rounded-3xl border border-slate-200',
      tone === 'slate' ? 'bg-slate-50/70' : 'bg-white',
    ].join(' ')}
  >
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </div>
      {description ? (
        <p className="mt-2 text-[12px] leading-5 text-slate-500">{description}</p>
      ) : null}
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

const InfoPill: React.FC<{ children: React.ReactNode; tone?: 'slate' | 'amber' | 'blue' }> = ({
  children,
  tone = 'slate',
}) => {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'blue'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
};

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-[12px] leading-5 text-slate-500">{description}</div>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition',
        checked ? 'bg-slate-900' : 'bg-slate-200',
      ].join(' ')}
      aria-pressed={checked}
    >
      <span
        className={[
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  </label>
);

export const MainBrainConfigCenter: React.FC<MainBrainConfigCenterProps> = ({
  onClose,
  userAssetApi,
  revision,
  onSaved,
  legacyPreferenceDraft,
  legacyPreferenceDirty,
  legacyPreferenceDefaultText,
  legacyPreferenceStoredCount,
  onLegacyPreferenceDraftChange,
  onSaveLegacyPreferences,
  onResetLegacyPreferences,
}) => {
  const [activeSection, setActiveSection] = React.useState<MainBrainSectionId>('overview');
  const [soulDraft, setSoulDraft] = React.useState<SoulDraft>(() =>
    buildSoulDraft(userAssetApi.getMainBrainSoul()),
  );
  const [userDraft, setUserDraft] = React.useState<UserDraft>(() =>
    buildUserDraft(userAssetApi.getMainBrainUser()),
  );
  const [workflowDraft, setWorkflowDraft] = React.useState<WorkflowDraft>(() =>
    buildWorkflowDraft(userAssetApi.getMainBrainWorkflow()),
  );
  const [bootstrapDraft, setBootstrapDraft] = React.useState<BootstrapDraft>(() =>
    buildBootstrapDraft({
      bootstrapAsset: userAssetApi.getMainBrainBootstrap(),
      soulAsset: userAssetApi.getMainBrainSoul(),
      userAsset: userAssetApi.getMainBrainUser(),
      workflowAsset: userAssetApi.getMainBrainWorkflow(),
    }),
  );
  const [memoryFilter, setMemoryFilter] = React.useState<MemoryFilterId>('pending');
  const [selectedMemoryId, setSelectedMemoryId] = React.useState('');
  const [heartbeatDraft, setHeartbeatDraft] = React.useState<HeartbeatDraft>(() =>
    buildHeartbeatDraft(userAssetApi.getMainBrainHeartbeat()),
  );
  const [selectedHeartbeatTaskId, setSelectedHeartbeatTaskId] = React.useState('');
  const [heartbeatTaskDraft, setHeartbeatTaskDraft] = React.useState<HeartbeatTaskDraft | null>(() => {
    const firstTask = Object.values(userAssetApi.getMainBrainHeartbeat().heartbeatTasks || {})[0];
    return firstTask ? buildHeartbeatTaskDraft(firstTask) : null;
  });

  React.useEffect(() => {
    const nextSoul = userAssetApi.getMainBrainSoul();
    const nextUser = userAssetApi.getMainBrainUser();
    const nextWorkflow = userAssetApi.getMainBrainWorkflow();
    const nextHeartbeat = userAssetApi.getMainBrainHeartbeat();
    setSoulDraft(buildSoulDraft(nextSoul));
    setUserDraft(buildUserDraft(nextUser));
    setWorkflowDraft(buildWorkflowDraft(nextWorkflow));
    setBootstrapDraft(
      buildBootstrapDraft({
        bootstrapAsset: userAssetApi.getMainBrainBootstrap(),
        soulAsset: nextSoul,
        userAsset: nextUser,
        workflowAsset: nextWorkflow,
      }),
    );
    setHeartbeatDraft(buildHeartbeatDraft(nextHeartbeat));
    setSelectedMemoryId('');
    setSelectedHeartbeatTaskId('');
    setHeartbeatTaskDraft(null);
  }, [revision, userAssetApi]);

  const soulAsset = userAssetApi.getMainBrainSoul();
  const userAsset = userAssetApi.getMainBrainUser();
  const workflowAsset = userAssetApi.getMainBrainWorkflow();
  const memoryAsset = userAssetApi.getMainBrainMemory();
  const heartbeatAsset = userAssetApi.getMainBrainHeartbeat();
  const bootstrapAsset = userAssetApi.getMainBrainBootstrap();

  const activeMemories = Object.values(memoryAsset.memoryRecords || {}).filter(
    (item) => item.status === 'active',
  );
  const pendingMemoryCount = memoryAsset.pendingMemoryCandidates.length;
  const heartbeatTaskCount = Object.keys(heartbeatAsset.heartbeatTasks || {}).length;
  const latestUpdatedAt = Math.max(
    soulAsset.updatedAt || 0,
    userAsset.updatedAt || 0,
    workflowAsset.updatedAt || 0,
    memoryAsset.updatedAt || 0,
    heartbeatAsset.updatedAt || 0,
    bootstrapAsset.updatedAt || 0,
  );
  const allMemoryRecords = Object.values(memoryAsset.memoryRecords || {}).sort(
    (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
  );
  const pendingMemoryRecords = memoryAsset.pendingMemoryCandidates.flatMap((id) => {
    const record = memoryAsset.memoryRecords[id];
    return record ? [record] : [];
  });
  const activeMemoryRecords = memoryAsset.memoryIndex.flatMap((id) => {
    const record = memoryAsset.memoryRecords[id];
    return record && record.status === 'active' ? [record] : [];
  });
  const recentMemoryRecords = allMemoryRecords.filter((item) => item.status !== 'dismissed');
  const visibleMemoryRecords =
    memoryFilter === 'pending'
      ? pendingMemoryRecords
      : memoryFilter === 'active'
        ? activeMemoryRecords
        : recentMemoryRecords;
  const selectedMemory =
    visibleMemoryRecords.find((item) => item.id === selectedMemoryId) || visibleMemoryRecords[0] || null;

  const heartbeatTasks = Object.values(heartbeatAsset.heartbeatTasks || {}).sort((left, right) =>
    (right.nextRunAt || right.lastRunAt || 0) - (left.nextRunAt || left.lastRunAt || 0),
  );
  const selectedHeartbeatTask =
    heartbeatTasks.find((item) => item.id === selectedHeartbeatTaskId) || heartbeatTasks[0] || null;

  const soulDirty = React.useMemo(() => {
    const current = buildSoulDraft(userAssetApi.getMainBrainSoul());
    return JSON.stringify({
      ...soulDraft,
      toneText: normalizeDraftText(soulDraft.toneText),
      workingStyleText: normalizeDraftText(soulDraft.workingStyleText),
      restraintRulesText: normalizeDraftText(soulDraft.restraintRulesText),
      selfCheckRulesText: normalizeDraftText(soulDraft.selfCheckRulesText),
      persona: soulDraft.persona.trim(),
    }) !==
      JSON.stringify({
        ...current,
        toneText: normalizeDraftText(current.toneText),
        workingStyleText: normalizeDraftText(current.workingStyleText),
        restraintRulesText: normalizeDraftText(current.restraintRulesText),
        selfCheckRulesText: normalizeDraftText(current.selfCheckRulesText),
        persona: current.persona.trim(),
      });
  }, [soulDraft, userAssetApi, revision]);

  const userDirty = React.useMemo(() => {
    const current = buildUserDraft(userAssetApi.getMainBrainUser());
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(userDraft).map(([key, value]) => [key, normalizeDraftText(String(value))]),
      ),
    ) !==
      JSON.stringify(
        Object.fromEntries(
          Object.entries(current).map(([key, value]) => [key, normalizeDraftText(String(value))]),
        ),
      );
  }, [userDraft, userAssetApi, revision]);

  const workflowDirty = React.useMemo(() => {
    const current = buildWorkflowDraft(userAssetApi.getMainBrainWorkflow());
    return JSON.stringify({
      ...workflowDraft,
      toolUseGuidelinesText: normalizeDraftText(workflowDraft.toolUseGuidelinesText),
      failureRecoveryRulesText: normalizeDraftText(workflowDraft.failureRecoveryRulesText),
    }) !==
      JSON.stringify({
        ...current,
        toolUseGuidelinesText: normalizeDraftText(current.toolUseGuidelinesText),
        failureRecoveryRulesText: normalizeDraftText(current.failureRecoveryRulesText),
      });
  }, [workflowDraft, userAssetApi, revision]);

  const bootstrapDirty = React.useMemo(() => {
    const current = buildBootstrapDraft({
      bootstrapAsset: userAssetApi.getMainBrainBootstrap(),
      soulAsset: userAssetApi.getMainBrainSoul(),
      userAsset: userAssetApi.getMainBrainUser(),
      workflowAsset: userAssetApi.getMainBrainWorkflow(),
    });
    return JSON.stringify({ ...bootstrapDraft, projectTypesText: bootstrapDraft.projectTypesText.trim() }) !==
      JSON.stringify({ ...current, projectTypesText: current.projectTypesText.trim() });
  }, [bootstrapDraft, userAssetApi, revision]);

  const heartbeatDirty = React.useMemo(() => {
    const current = buildHeartbeatDraft(userAssetApi.getMainBrainHeartbeat());
    return JSON.stringify({ ...heartbeatDraft, scopeText: normalizeDraftText(heartbeatDraft.scopeText), recentRunSummaryText: normalizeDraftText(heartbeatDraft.recentRunSummaryText) }) !==
      JSON.stringify({ ...current, scopeText: normalizeDraftText(current.scopeText), recentRunSummaryText: normalizeDraftText(current.recentRunSummaryText) });
  }, [heartbeatDraft, userAssetApi, revision]);

  const heartbeatTaskDirty = React.useMemo(() => {
    if (!heartbeatTaskDraft || !selectedHeartbeatTask) return false;
    const current = buildHeartbeatTaskDraft(selectedHeartbeatTask);
    return JSON.stringify({ ...heartbeatTaskDraft, scopeText: normalizeDraftText(heartbeatTaskDraft.scopeText), title: heartbeatTaskDraft.title.trim(), lastSummary: heartbeatTaskDraft.lastSummary.trim() }) !==
      JSON.stringify({ ...current, scopeText: normalizeDraftText(current.scopeText), title: current.title.trim(), lastSummary: current.lastSummary.trim() });
  }, [heartbeatTaskDraft, selectedHeartbeatTask]);

  React.useEffect(() => {
    if (visibleMemoryRecords.length === 0) {
      if (selectedMemoryId) setSelectedMemoryId('');
      return;
    }
    if (!visibleMemoryRecords.some((item) => item.id === selectedMemoryId)) {
      setSelectedMemoryId(visibleMemoryRecords[0].id);
    }
  }, [selectedMemoryId, visibleMemoryRecords]);

  React.useEffect(() => {
    if (!selectedHeartbeatTask) {
      if (selectedHeartbeatTaskId) setSelectedHeartbeatTaskId('');
      setHeartbeatTaskDraft(null);
      return;
    }
    if (selectedHeartbeatTask.id !== selectedHeartbeatTaskId) {
      setSelectedHeartbeatTaskId(selectedHeartbeatTask.id);
    }
    setHeartbeatTaskDraft(buildHeartbeatTaskDraft(selectedHeartbeatTask));
  }, [selectedHeartbeatTask, selectedHeartbeatTaskId]);

  const soulPreview = React.useMemo(
    () =>
      [
        soulDraft.persona.trim() ? `Persona：${soulDraft.persona.trim()}` : '',
        ...summarizeList('Tone', soulDraft.toneText),
        ...summarizeList('Working style', soulDraft.workingStyleText),
        ...summarizeList('Restraints', soulDraft.restraintRulesText),
        ...summarizeList('Self-check', soulDraft.selfCheckRulesText),
        `Risk preference：${soulDraft.riskPreference}`,
      ]
        .filter(Boolean)
        .join('\n'),
    [soulDraft],
  );

  const userPreview = React.useMemo(
    () =>
      [
        ...summarizeList('Goals', userDraft.goalsText),
        ...summarizeList('Working habits', userDraft.workingHabitsText),
        ...summarizeList('Business context', userDraft.businessContextText),
        ...summarizeList('Aesthetic', userDraft.aestheticPreferencesText),
        ...summarizeList('Communication', userDraft.communicationStyleText),
        ...summarizeList('Permanent notes', userDraft.permanentNotesText),
      ]
        .filter(Boolean)
        .join('\n'),
    [userDraft],
  );

  const workflowPreview = React.useMemo(
    () =>
      [
        `Analysis depth：${workflowDraft.defaultAnalysisDepth}`,
        `Search policy：${workflowDraft.searchPolicy}`,
        `Clarify first：${workflowDraft.clarifyBeforeExecution ? 'yes' : 'no'}`,
        ...summarizeList('Tool guidelines', workflowDraft.toolUseGuidelinesText),
        ...summarizeList('Recovery rules', workflowDraft.failureRecoveryRulesText),
        `Governance：${workflowDraft.governanceMode} / draft=${workflowDraft.allowDraft ? 'yes' : 'no'} / promote=${workflowDraft.allowAutoPromote ? 'yes' : 'no'} / archive=${workflowDraft.allowAutoArchive ? 'yes' : 'no'}`,
      ]
        .filter(Boolean)
        .join('\n'),
    [workflowDraft],
  );

  const bootstrapPreview = React.useMemo(() => {
    const defaults = buildBootstrapDefaults(bootstrapDraft);
    return [
      `协作定位：${bootstrapDraft.collaborationMode}`,
      `输出方式：${bootstrapDraft.responseStyle}`,
      `搜索策略：${bootstrapDraft.searchPolicy}`,
      `角色草案：${bootstrapDraft.allowRoleDrafts ? '允许生成候选草案' : '仅手动维护'}`,
      `Heartbeat：${bootstrapDraft.allowHeartbeat ? '后续可定期整理长期记忆' : '默认保持关闭'}`,
      bootstrapDraft.projectTypesText.trim() ? `常见项目：${bootstrapDraft.projectTypesText.trim()}` : '常见项目：未填写',
      '',
      `Soul：${defaults.soul.persona}`,
      `User：${defaults.user.businessContext[0]}`,
      `Workflow：分析 ${defaults.workflow.defaultAnalysisDepth} / 搜索 ${defaults.workflow.searchPolicy} / 治理 ${defaults.workflow.roleGovernanceDefaults.mode}`,
    ].join('\n');
  }, [bootstrapDraft]);

  const heartbeatPreview = React.useMemo(
    () =>
      [
        `Heartbeat enabled：${heartbeatDraft.enabled ? 'yes' : 'no'}`,
        `Global cadence：${heartbeatDraft.cadence}`,
        ...summarizeList('Scope', heartbeatDraft.scopeText),
        ...summarizeList('Recent runs', heartbeatDraft.recentRunSummaryText, 3),
        selectedHeartbeatTask
          ? `Focused task：${selectedHeartbeatTask.title} / ${selectedHeartbeatTask.enabled ? 'enabled' : 'disabled'} / ${selectedHeartbeatTask.cadence}`
          : 'Focused task：当前没有已定义的 Heartbeat 任务',
      ]
        .filter(Boolean)
        .join('\n'),
    [heartbeatDraft, selectedHeartbeatTask],
  );

  const memoryPreview = React.useMemo(
    () =>
      [
        `Pending candidates：${pendingMemoryRecords.length}`,
        `Active memories：${activeMemoryRecords.length}`,
        activeMemoryRecords[0]?.summary ? `Latest active：${activeMemoryRecords[0].summary}` : '',
        pendingMemoryRecords[0]?.summary ? `Next review：${pendingMemoryRecords[0].summary}` : '',
        memoryAsset.dailySummary[0] ? `Daily summary：${memoryAsset.dailySummary[0]}` : '',
        memoryAsset.memoryBlacklists[0] ? `Blacklist：${memoryAsset.memoryBlacklists[0]}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    [activeMemoryRecords, memoryAsset.dailySummary, memoryAsset.memoryBlacklists, pendingMemoryRecords],
  );

  const handleSaveSoul = React.useCallback(() => {
    userAssetApi.setMainBrainSoul({
      persona: soulDraft.persona.trim(),
      tone: toLines(soulDraft.toneText),
      workingStyle: toLines(soulDraft.workingStyleText),
      restraintRules: toLines(soulDraft.restraintRulesText),
      selfCheckRules: toLines(soulDraft.selfCheckRulesText),
      riskPreference: soulDraft.riskPreference,
    });
    onSaved();
  }, [onSaved, soulDraft, userAssetApi]);

  const handleResetSoul = React.useCallback(() => {
    setSoulDraft(buildSoulDraft(userAssetApi.getMainBrainSoul()));
  }, [userAssetApi]);

  const handleSaveUser = React.useCallback(() => {
    userAssetApi.setMainBrainUser({
      goals: toLines(userDraft.goalsText),
      workingHabits: toLines(userDraft.workingHabitsText),
      businessContext: toLines(userDraft.businessContextText),
      aestheticPreferences: toLines(userDraft.aestheticPreferencesText),
      communicationStyle: toLines(userDraft.communicationStyleText),
      permanentNotes: toLines(userDraft.permanentNotesText),
      memoryBlacklist: toLines(userDraft.memoryBlacklistText),
    });
    onSaved();
  }, [onSaved, userAssetApi, userDraft]);

  const handleResetUser = React.useCallback(() => {
    setUserDraft(buildUserDraft(userAssetApi.getMainBrainUser()));
  }, [userAssetApi]);

  const handleSaveWorkflow = React.useCallback(() => {
    userAssetApi.setMainBrainWorkflow({
      defaultAnalysisDepth: workflowDraft.defaultAnalysisDepth,
      searchPolicy: workflowDraft.searchPolicy,
      clarifyBeforeExecution: workflowDraft.clarifyBeforeExecution,
      toolUseGuidelines: toLines(workflowDraft.toolUseGuidelinesText),
      failureRecoveryRules: toLines(workflowDraft.failureRecoveryRulesText),
      roleGovernanceDefaults: {
        mode: workflowDraft.governanceMode,
        allowDraft: workflowDraft.allowDraft,
        allowAutoPromote: workflowDraft.allowAutoPromote,
        allowAutoArchive: workflowDraft.allowAutoArchive,
      },
    });
    onSaved();
  }, [onSaved, userAssetApi, workflowDraft]);

  const handleResetWorkflow = React.useCallback(() => {
    setWorkflowDraft(buildWorkflowDraft(userAssetApi.getMainBrainWorkflow()));
  }, [userAssetApi]);

  const handleSaveBootstrap = React.useCallback(() => {
    const defaults = buildBootstrapDefaults(bootstrapDraft);
    const now = Date.now();
    const currentBootstrap = userAssetApi.getMainBrainBootstrap();
    userAssetApi.setMainBrainSoul(defaults.soul);
    userAssetApi.setMainBrainUser(defaults.user);
    userAssetApi.setMainBrainWorkflow(defaults.workflow);
    userAssetApi.setMainBrainBootstrap({
      initialized: true,
      initializedAt: currentBootstrap.initializedAt || now,
      sourceTemplate: buildBootstrapSourceTemplate(bootstrapDraft),
      completedSteps: [
        'collaboration-mode',
        'response-style',
        'search-policy',
        bootstrapDraft.allowRoleDrafts ? 'role-draft-enabled' : 'role-draft-disabled',
        bootstrapDraft.allowHeartbeat ? 'heartbeat-enabled' : 'heartbeat-disabled',
        'project-types',
        currentBootstrap.initialized ? 'rebootstrap-applied' : 'bootstrap-applied',
      ],
      lastRebootstrapAt: currentBootstrap.initialized ? now : null,
    });
    onSaved();
  }, [bootstrapDraft, onSaved, userAssetApi]);

  const handleResetBootstrap = React.useCallback(() => {
    setBootstrapDraft(
      buildBootstrapDraft({
        bootstrapAsset: userAssetApi.getMainBrainBootstrap(),
        soulAsset: userAssetApi.getMainBrainSoul(),
        userAsset: userAssetApi.getMainBrainUser(),
        workflowAsset: userAssetApi.getMainBrainWorkflow(),
      }),
    );
  }, [userAssetApi]);

  const handlePromoteMemory = React.useCallback(
    (memoryId: string) => {
      const current = userAssetApi.getMainBrainMemory();
      const target = current.memoryRecords[memoryId];
      if (!target) return;
      userAssetApi.setMainBrainMemory({
        memoryRecords: {
          ...current.memoryRecords,
          [memoryId]: {
            ...target,
            status: 'active',
            updatedAt: Date.now(),
          },
        },
        memoryIndex: Array.from(new Set([memoryId, ...current.memoryIndex.filter((id) => id !== memoryId)])),
        pendingMemoryCandidates: current.pendingMemoryCandidates.filter((id) => id !== memoryId),
      });
      onSaved();
    },
    [onSaved, userAssetApi],
  );

  const handleDemoteMemory = React.useCallback(
    (memoryId: string) => {
      const current = userAssetApi.getMainBrainMemory();
      const target = current.memoryRecords[memoryId];
      if (!target) return;
      userAssetApi.setMainBrainMemory({
        memoryRecords: {
          ...current.memoryRecords,
          [memoryId]: {
            ...target,
            status: 'candidate',
            updatedAt: Date.now(),
          },
        },
        memoryIndex: current.memoryIndex.filter((id) => id !== memoryId),
        pendingMemoryCandidates: Array.from(
          new Set([memoryId, ...current.pendingMemoryCandidates.filter((id) => id !== memoryId)]),
        ),
      });
      onSaved();
    },
    [onSaved, userAssetApi],
  );

  const handleDismissMemory = React.useCallback(
    (memoryId: string) => {
      const current = userAssetApi.getMainBrainMemory();
      const target = current.memoryRecords[memoryId];
      if (!target) return;
      userAssetApi.setMainBrainMemory({
        memoryRecords: {
          ...current.memoryRecords,
          [memoryId]: {
            ...target,
            status: 'dismissed',
            updatedAt: Date.now(),
          },
        },
        memoryIndex: current.memoryIndex.filter((id) => id !== memoryId),
        pendingMemoryCandidates: current.pendingMemoryCandidates.filter((id) => id !== memoryId),
      });
      onSaved();
    },
    [onSaved, userAssetApi],
  );

  const handleDeleteMemory = React.useCallback(
    (memoryId: string) => {
      const current = userAssetApi.getMainBrainMemory();
      if (!current.memoryRecords[memoryId]) return;
      const nextRecords = { ...current.memoryRecords };
      delete nextRecords[memoryId];
      userAssetApi.setMainBrainMemory({
        memoryRecords: nextRecords,
        memoryIndex: current.memoryIndex.filter((id) => id !== memoryId),
        pendingMemoryCandidates: current.pendingMemoryCandidates.filter((id) => id !== memoryId),
      });
      onSaved();
    },
    [onSaved, userAssetApi],
  );

  const handleSaveHeartbeat = React.useCallback(() => {
    userAssetApi.setMainBrainHeartbeat({
      enabled: heartbeatDraft.enabled,
      cadence: heartbeatDraft.cadence,
      scope: toLines(heartbeatDraft.scopeText),
      recentRunSummary: toLines(heartbeatDraft.recentRunSummaryText),
    });
    onSaved();
  }, [heartbeatDraft, onSaved, userAssetApi]);

  const handleResetHeartbeat = React.useCallback(() => {
    setHeartbeatDraft(buildHeartbeatDraft(userAssetApi.getMainBrainHeartbeat()));
  }, [userAssetApi]);

  const handleCreateHeartbeatTask = React.useCallback(
    (type: StudioMainBrainHeartbeatTaskType) => {
      const current = userAssetApi.getMainBrainHeartbeat();
      const template = HEARTBEAT_TASK_TEMPLATES.find((item) => item.type === type);
      if (!template) return;
      const nextId = `heartbeat-${type}`;
      userAssetApi.setMainBrainHeartbeat({
        heartbeatTasks: {
          ...current.heartbeatTasks,
          [nextId]: {
            id: nextId,
            type,
            title: template.title,
            enabled: true,
            cadence: current.cadence === 'manual' ? 'daily' : current.cadence,
            scope: current.scope,
            lastRunAt: null,
            nextRunAt: null,
            lastSummary: template.defaultSummary,
          },
        },
      });
      setSelectedHeartbeatTaskId(nextId);
      onSaved();
    },
    [onSaved, userAssetApi],
  );

  const handleSaveHeartbeatTask = React.useCallback(() => {
    if (!heartbeatTaskDraft) return;
    const current = userAssetApi.getMainBrainHeartbeat();
    const existing = current.heartbeatTasks[heartbeatTaskDraft.id];
    if (!existing) return;
    userAssetApi.setMainBrainHeartbeat({
      heartbeatTasks: {
        ...current.heartbeatTasks,
        [heartbeatTaskDraft.id]: {
          ...existing,
          type: heartbeatTaskDraft.type,
          title: heartbeatTaskDraft.title.trim() || existing.title,
          enabled: heartbeatTaskDraft.enabled,
          cadence: heartbeatTaskDraft.cadence,
          scope: toLines(heartbeatTaskDraft.scopeText),
          lastSummary: heartbeatTaskDraft.lastSummary.trim(),
        },
      },
    });
    onSaved();
  }, [heartbeatTaskDraft, onSaved, userAssetApi]);

  const handleResetHeartbeatTask = React.useCallback(() => {
    if (!selectedHeartbeatTask) return;
    setHeartbeatTaskDraft(buildHeartbeatTaskDraft(selectedHeartbeatTask));
  }, [selectedHeartbeatTask]);

  const handleDeleteHeartbeatTask = React.useCallback(() => {
    if (!selectedHeartbeatTask) return;
    const current = userAssetApi.getMainBrainHeartbeat();
    const nextTasks = { ...current.heartbeatTasks };
    delete nextTasks[selectedHeartbeatTask.id];
    userAssetApi.setMainBrainHeartbeat({
      heartbeatTasks: nextTasks,
    });
    setSelectedHeartbeatTaskId('');
    setHeartbeatTaskDraft(null);
    onSaved();
  }, [onSaved, selectedHeartbeatTask, userAssetApi]);

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {[
          {
            title: 'Soul 摘要',
            value: soulAsset.persona || '尚未定义人格定位',
            meta: `${toLines(soulAsset.tone.join('\n')).length} 条表达风格 / ${toLines(soulAsset.workingStyle.join('\n')).length} 条工作风格`,
            icon: Brain,
          },
          {
            title: 'User 摘要',
            value: toLines(userAsset.goals.join('\n'))[0] || '尚未定义用户长期目标',
            meta: `${toLines(userAsset.workingHabits.join('\n')).length} 条工作习惯 / ${toLines(userAsset.businessContext.join('\n')).length} 条业务背景`,
            icon: UserRound,
          },
          {
            title: 'Workflow 摘要',
            value: `分析 ${workflowAsset.defaultAnalysisDepth} · 搜索 ${workflowAsset.searchPolicy}`,
            meta: `澄清优先：${workflowAsset.clarifyBeforeExecution ? '是' : '否'} / 工具规则 ${workflowAsset.toolUseGuidelines.length} 条`,
            icon: Route,
          },
          {
            title: 'Role Governance 默认策略',
            value: workflowAsset.roleGovernanceDefaults.mode,
            meta: `草案 ${workflowAsset.roleGovernanceDefaults.allowDraft ? '允许' : '禁止'} · 自动升级 ${workflowAsset.roleGovernanceDefaults.allowAutoPromote ? '允许' : '禁止'}`,
            icon: ShieldCheck,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {item.title}
                  </div>
                  <div className="mt-3 text-[15px] font-semibold leading-6 text-slate-900">
                    {item.value}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-100 p-2 text-slate-600">
                  <Icon size={16} />
                </div>
              </div>
              <div className="mt-3 text-[12px] leading-5 text-slate-500">{item.meta}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="运行状态" description="只展示需要立即判断的信息，不堆全量详情。">
          <div className="space-y-3 text-[13px] leading-6 text-slate-700">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50/70 px-4 py-3">
              <span>Bootstrap 初始化</span>
              <InfoPill tone="blue">{bootstrapAsset.initialized ? '已完成' : '待初始化'}</InfoPill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-4 py-3">
              <span>已确认长期记忆</span>
              <InfoPill>{activeMemories.length} 条</InfoPill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/70 px-4 py-3">
              <span>待确认记忆</span>
              <InfoPill tone="amber">{pendingMemoryCount} 条</InfoPill>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/80 px-4 py-3">
              <span>Heartbeat 任务</span>
              <InfoPill>{heartbeatTaskCount} 个</InfoPill>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="最近摘要" description="帮助判断主脑当前是否处于可用、可控状态。">
          <div className="space-y-3 text-[12px] leading-6 text-slate-700">
            <div>
              <div className="font-semibold text-slate-900">最近记忆摘要</div>
              <div className="mt-1 text-slate-600">
                {activeMemories[0]?.summary || '当前没有已确认长期记忆。'}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">最近 Heartbeat 摘要</div>
              <div className="mt-1 text-slate-600">
                {heartbeatAsset.recentRunSummary[0] || 'Heartbeat 暂无最近执行摘要。'}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Bootstrap 状态</div>
              <div className="mt-1 text-slate-600">
                {bootstrapAsset.initialized
                  ? `首次初始化 ${formatTime(bootstrapAsset.initializedAt)}${bootstrapAsset.lastRebootstrapAt ? ` · 最近重跑 ${formatTime(bootstrapAsset.lastRebootstrapAt)}` : ''}`
                  : '当前还未完成主脑首次初始化。'}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">最近变更时间</div>
              <div className="mt-1 text-slate-600">{formatTime(latestUpdatedAt)}</div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="快速入口" description="先把高频配置集中收口，其余复杂模块后续再接。">
          <div className="grid gap-2">
            {PRIMARY_SECTIONS.filter((item) => item.id !== 'overview').map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-500">{item.caption}</div>
                  </div>
                  <Icon size={15} className="shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="共享补充层" description="保留旧的全局偏好行编辑能力，作为结构化资产之外的补充约束。">
        <div className="space-y-4">
          <textarea
            value={legacyPreferenceDraft}
            onChange={(event) => onLegacyPreferenceDraftChange(event.target.value)}
            placeholder="例如：改代码前先检查是否仍然走到了旧链路。"
            className="min-h-[180px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] leading-5 text-slate-400">
              当前已保存 {legacyPreferenceStoredCount} 条共享补充偏好，继续作为运行时注入的一部分。
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onResetLegacyPreferences}
                disabled={legacyPreferenceStoredCount === 0 && !legacyPreferenceDraft.trim()}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                清空补充层
              </button>
              <button
                type="button"
                onClick={onSaveLegacyPreferences}
                disabled={!legacyPreferenceDirty}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                保存补充层
              </button>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );

  const renderSoul = () => (
    <div className="space-y-4">
      <SectionCard title="人格与表达" description="定义主脑在长期协作中的人格定位、表达方式与做事风格。">
        <div className="space-y-4 text-[13px] leading-6 text-slate-700">
          <label className="block">
            <div className="font-semibold text-slate-900">人格定位</div>
            <textarea
              value={soulDraft.persona}
              onChange={(event) => setSoulDraft((current) => ({ ...current, persona: event.target.value }))}
              placeholder="例如：冷静、克制、以闭环验证为先的产品工程主脑。"
              className="mt-2 min-h-[92px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
          </label>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <div className="font-semibold text-slate-900">表达风格</div>
              <textarea
                value={soulDraft.toneText}
                onChange={(event) => setSoulDraft((current) => ({ ...current, toneText: event.target.value }))}
                placeholder="一行一条，例如：直接、克制、结论先行"
                className="mt-2 min-h-[132px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              />
            </label>
            <label className="block">
              <div className="font-semibold text-slate-900">工作风格</div>
              <textarea
                value={soulDraft.workingStyleText}
                onChange={(event) =>
                  setSoulDraft((current) => ({ ...current, workingStyleText: event.target.value }))
                }
                placeholder="一行一条，例如：先审链路，再做实现"
                className="mt-2 min-h-[132px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              />
            </label>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="克制与风控" description="控制主脑在哪些地方必须克制、自检，以及遇到风险时倾向如何处理。">
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block">
            <div className="font-semibold text-slate-900">克制规则</div>
            <textarea
              value={soulDraft.restraintRulesText}
              onChange={(event) =>
                setSoulDraft((current) => ({ ...current, restraintRulesText: event.target.value }))
              }
              placeholder="一行一条，例如：不要伪装完成"
              className="mt-2 min-h-[148px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
          </label>
          <label className="block">
            <div className="font-semibold text-slate-900">自检规则</div>
            <textarea
              value={soulDraft.selfCheckRulesText}
              onChange={(event) =>
                setSoulDraft((current) => ({ ...current, selfCheckRulesText: event.target.value }))
              }
              placeholder="一行一条，例如：输出前检查真实闭环"
              className="mt-2 min-h-[148px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
          </label>
        </div>
        <div className="mt-4">
          <div className="font-semibold text-slate-900">风险偏好</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {[
              { value: 'conservative', label: '保守', desc: '优先稳定、先验证再执行' },
              { value: 'balanced', label: '平衡', desc: '在效率与风险之间折中' },
              { value: 'aggressive', label: '激进', desc: '允许更高试错率与推进速度' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setSoulDraft((current) => ({
                    ...current,
                    riskPreference: item.value as SoulDraft['riskPreference'],
                  }))
                }
                className={[
                  'rounded-2xl border px-4 py-3 text-left transition',
                  soulDraft.riskPreference === item.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                <div className="text-[13px] font-semibold">{item.label}</div>
                <div
                  className={[
                    'mt-1 text-[11px] leading-5',
                    soulDraft.riskPreference === item.value ? 'text-slate-200' : 'text-slate-500',
                  ].join(' ')}
                >
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleResetSoul}
            disabled={!soulDirty}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            重置 Soul
          </button>
          <button
            type="button"
            onClick={handleSaveSoul}
            disabled={!soulDirty}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            保存 Soul
          </button>
        </div>
      </SectionCard>
    </div>
  );

  const renderUser = () => (
    <div className="space-y-4">
      <SectionCard title="用户长期画像" description="这里存的是对用户本人的长期理解，不是单次任务说明。">
        <div className="grid gap-4 xl:grid-cols-2 text-[13px] leading-6 text-slate-700">
          {[
            ['用户目标', 'goalsText', '例如：把配置中心做成真功能'],
            ['工作习惯', 'workingHabitsText', '例如：先修底层再修 UI'],
            ['业务背景', 'businessContextText', '例如：这是产品级工作台'],
            ['美学偏好', 'aestheticPreferencesText', '例如：克制、专业、留白充足'],
            ['沟通习惯', 'communicationStyleText', '例如：中文直达结论'],
            ['长期备注', 'permanentNotesText', '例如：不要只看构建通过'],
          ].map(([label, key, placeholder]) => (
            <label key={key} className="block">
              <div className="font-semibold text-slate-900">{label}</div>
              <textarea
                value={userDraft[key as keyof UserDraft] as string}
                onChange={(event) =>
                  setUserDraft((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                placeholder={placeholder}
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              />
            </label>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="记忆边界" description="定义哪些信息不应该被主脑长期记住，避免记忆污染。">
        <label className="block text-[13px] leading-6 text-slate-700">
          <div className="font-semibold text-slate-900">记忆黑名单</div>
          <textarea
            value={userDraft.memoryBlacklistText}
            onChange={(event) =>
              setUserDraft((current) => ({ ...current, memoryBlacklistText: event.target.value }))
            }
            placeholder="一行一条，例如：一次性临时口头示例"
            className="mt-2 min-h-[128px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
          />
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleResetUser}
            disabled={!userDirty}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            重置 User
          </button>
          <button
            type="button"
            onClick={handleSaveUser}
            disabled={!userDirty}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            保存 User
          </button>
        </div>
      </SectionCard>
    </div>
  );

  const renderWorkflow = () => (
    <div className="space-y-4">
      <SectionCard title="默认工作策略" description="控制主脑默认怎么分析、要不要优先搜索、遇到不明确时是否先澄清。">
        <div className="grid gap-4 xl:grid-cols-2 text-[13px] leading-6 text-slate-700">
          <label className="block">
            <div className="font-semibold text-slate-900">默认分析深度</div>
            <select
              value={workflowDraft.defaultAnalysisDepth}
              onChange={(event) =>
                setWorkflowDraft((current) => ({
                  ...current,
                  defaultAnalysisDepth: event.target.value as StudioMainBrainAnalysisDepth,
                }))
              }
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
            >
              <option value="light">light</option>
              <option value="balanced">balanced</option>
              <option value="deep">deep</option>
            </select>
          </label>
          <label className="block">
            <div className="font-semibold text-slate-900">联网搜索策略</div>
            <select
              value={workflowDraft.searchPolicy}
              onChange={(event) =>
                setWorkflowDraft((current) => ({
                  ...current,
                  searchPolicy: event.target.value as StudioMainBrainSearchPolicy,
                }))
              }
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
            >
              <option value="never">never</option>
              <option value="auto">auto</option>
              <option value="prefer">prefer</option>
            </select>
          </label>
        </div>
        <div className="mt-4">
          <ToggleRow
            label="执行前先澄清"
            description="当需求边界不清时，默认先澄清再执行，避免主脑直接带着假设推进。"
            checked={workflowDraft.clarifyBeforeExecution}
            onChange={(next) =>
              setWorkflowDraft((current) => ({ ...current, clarifyBeforeExecution: next }))
            }
          />
        </div>
      </SectionCard>
      <SectionCard title="工具与恢复策略" description="定义工具使用原则，以及执行失败后主脑默认如何恢复。">
        <div className="grid gap-4 xl:grid-cols-2 text-[13px] leading-6 text-slate-700">
          <label className="block">
            <div className="font-semibold text-slate-900">工具使用原则</div>
            <textarea
              value={workflowDraft.toolUseGuidelinesText}
              onChange={(event) =>
                setWorkflowDraft((current) => ({
                  ...current,
                  toolUseGuidelinesText: event.target.value,
                }))
              }
              placeholder="一行一条，例如：先读再改、整链验证"
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
          </label>
          <label className="block">
            <div className="font-semibold text-slate-900">失败恢复策略</div>
            <textarea
              value={workflowDraft.failureRecoveryRulesText}
              onChange={(event) =>
                setWorkflowDraft((current) => ({
                  ...current,
                  failureRecoveryRulesText: event.target.value,
                }))
              }
              placeholder="一行一条，例如：失败先定位根因"
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
            />
          </label>
        </div>
      </SectionCard>
      <SectionCard title="默认角色治理策略" description="这里是 Workflow 层的默认治理策略，用于避免与角色治理形成两套冲突默认值。">
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block text-[13px] leading-6 text-slate-700 xl:col-span-2">
            <div className="font-semibold text-slate-900">治理模式</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {[
                {
                  value: 'manual_only',
                  label: '仅手动维护',
                  desc: '主脑只读不改，适合谨慎模式。',
                },
                {
                  value: 'approval_required',
                  label: '需要人工确认',
                  desc: '可以产出候选治理动作，但需要确认后落地。',
                },
                {
                  value: 'auto_manage',
                  label: '允许自动治理',
                  desc: '主脑可直接推进高频治理动作。',
                },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setWorkflowDraft((current) => ({
                      ...current,
                      governanceMode: item.value as WorkflowDraft['governanceMode'],
                    }))
                  }
                  className={[
                    'rounded-2xl border px-4 py-3 text-left transition',
                    workflowDraft.governanceMode === item.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <div className="text-[13px] font-semibold">{item.label}</div>
                  <div
                    className={[
                      'mt-1 text-[11px] leading-5',
                      workflowDraft.governanceMode === item.value
                        ? 'text-slate-200'
                        : 'text-slate-500',
                    ].join(' ')}
                  >
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </label>
          <ToggleRow
            label="允许产出治理草案"
            description="控制默认是否允许主脑先形成治理草案。"
            checked={workflowDraft.allowDraft}
            onChange={(next) =>
              setWorkflowDraft((current) => ({ ...current, allowDraft: next }))
            }
          />
          <ToggleRow
            label="允许自动升级角色"
            description="控制默认是否允许主脑直接把草案升级为正式角色。"
            checked={workflowDraft.allowAutoPromote}
            onChange={(next) =>
              setWorkflowDraft((current) => ({ ...current, allowAutoPromote: next }))
            }
          />
          <ToggleRow
            label="允许自动归档角色"
            description="控制默认是否允许主脑直接归档不再适用的角色。"
            checked={workflowDraft.allowAutoArchive}
            onChange={(next) =>
              setWorkflowDraft((current) => ({ ...current, allowAutoArchive: next }))
            }
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleResetWorkflow}
            disabled={!workflowDirty}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            重置 Workflow
          </button>
          <button
            type="button"
            onClick={handleSaveWorkflow}
            disabled={!workflowDirty}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            保存 Workflow
          </button>
        </div>
      </SectionCard>
    </div>
  );

  const renderBootstrap = () => {
    const initialized = bootstrapAsset.initialized;
    return (
      <div className="space-y-4">
        <SectionCard
          title="初始化状态"
          description="Bootstrap 用于完成首次主脑建档，或在后续统一重跑默认值。当前阶段会覆盖 Soul / User / Workflow 默认内容。"
        >
          <div className="space-y-4 text-[13px] leading-6 text-slate-700">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Activity size={15} className="text-slate-500" />
                  <span className="font-semibold">初始化状态</span>
                </div>
                <div className="mt-2 text-slate-600">{initialized ? '已完成初始化，可继续重跑默认值。' : '尚未初始化，建议先完成问卷建档。'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Clock3 size={15} className="text-slate-500" />
                  <span className="font-semibold">首次初始化</span>
                </div>
                <div className="mt-2 text-slate-600">{formatTime(bootstrapAsset.initializedAt)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Sparkles size={15} className="text-slate-500" />
                  <span className="font-semibold">最近重跑</span>
                </div>
                <div className="mt-2 text-slate-600">{formatTime(bootstrapAsset.lastRebootstrapAt)}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] leading-6 text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div>
                  当前版本的 Bootstrap 会直接重写默认 Soul / User / Workflow 配置，用于把“第一次怎么设主脑”做成真实落库链路，而不是停留在说明文档里。
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="首次问卷" description="先定义主脑的协作定位、输出方式与搜索偏好，再生成结构化默认值。">
          <div className="space-y-5 text-[13px] leading-6 text-slate-700">
            <div>
              <div className="font-semibold text-slate-900">1. 你希望主脑更像哪种协作对象？</div>
              <div className="mt-2 grid gap-3 xl:grid-cols-3">
                {[
                  {
                    value: 'advisor',
                    label: '顾问',
                    desc: '偏判断、建议、风险识别，适合需要方向感和治理感的场景。',
                  },
                  {
                    value: 'executor',
                    label: '执行助手',
                    desc: '偏拆解、推进、落地，适合任务明确、追求推进效率的场景。',
                  },
                  {
                    value: 'research_partner',
                    label: '研究搭档',
                    desc: '偏分析、证据、框架，适合需要推理链和洞察质量的场景。',
                  },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setBootstrapDraft((current) => ({
                        ...current,
                        collaborationMode: item.value as BootstrapDraft['collaborationMode'],
                      }))
                    }
                    className={[
                      'rounded-2xl border px-4 py-3 text-left transition',
                      bootstrapDraft.collaborationMode === item.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    <div className="text-[13px] font-semibold">{item.label}</div>
                    <div
                      className={[
                        'mt-1 text-[11px] leading-5',
                        bootstrapDraft.collaborationMode === item.value ? 'text-slate-200' : 'text-slate-500',
                      ].join(' ')}
                    >
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <div className="font-semibold text-slate-900">2. 你更偏好主脑默认怎么组织回答？</div>
                <div className="mt-2 grid gap-3">
                  {[
                    {
                      value: 'conclusion_first',
                      label: '先给结论',
                      desc: '优先给判断和下一步，必要时再展开依据。',
                    },
                    {
                      value: 'analysis_first',
                      label: '先展开分析',
                      desc: '先铺开框架、依据和边界，再收敛结论。',
                    },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        setBootstrapDraft((current) => ({
                          ...current,
                          responseStyle: item.value as BootstrapDraft['responseStyle'],
                        }))
                      }
                      className={[
                        'rounded-2xl border px-4 py-3 text-left transition',
                        bootstrapDraft.responseStyle === item.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <div className="text-[13px] font-semibold">{item.label}</div>
                      <div
                        className={[
                          'mt-1 text-[11px] leading-5',
                          bootstrapDraft.responseStyle === item.value ? 'text-slate-200' : 'text-slate-500',
                        ].join(' ')}
                      >
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <div className="font-semibold text-slate-900">3. 是否默认优先联网搜索？</div>
                <select
                  value={bootstrapDraft.searchPolicy}
                  onChange={(event) =>
                    setBootstrapDraft((current) => ({
                      ...current,
                      searchPolicy: event.target.value as StudioMainBrainSearchPolicy,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                >
                  <option value="never">never · 默认不搜</option>
                  <option value="auto">auto · 按需决定</option>
                  <option value="prefer">prefer · 默认优先搜索</option>
                </select>
                <div className="mt-2 text-[11px] leading-5 text-slate-500">
                  该选项会直接生成 Workflow 默认搜索策略，并影响后续运行时的默认分析习惯。
                </div>
              </label>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="治理与长期维护偏好" description="继续决定默认治理边界，并把用户的常见项目类型沉淀为长期画像的一部分。">
          <div className="space-y-4 text-[13px] leading-6 text-slate-700">
            <div className="grid gap-4 xl:grid-cols-2">
              <ToggleRow
                label="允许主脑自动生成长期角色草案"
                description="当前阶段会映射为 Workflow 里的默认治理策略；为避免过度自动化，生成后仍默认需要人工确认。"
                checked={bootstrapDraft.allowRoleDrafts}
                onChange={(next) =>
                  setBootstrapDraft((current) => ({ ...current, allowRoleDrafts: next }))
                }
              />
              <ToggleRow
                label="允许 Heartbeat 定期整理长期记忆"
                description="当前阶段先把偏好记入 Bootstrap 结果与用户长期备注，Heartbeat 模块独立落地后再接实际任务编排。"
                checked={bootstrapDraft.allowHeartbeat}
                onChange={(next) => setBootstrapDraft((current) => ({ ...current, allowHeartbeat: next }))}
              />
            </div>
            <label className="block">
              <div className="font-semibold text-slate-900">常见项目类型</div>
              <textarea
                value={bootstrapDraft.projectTypesText}
                onChange={(event) =>
                  setBootstrapDraft((current) => ({ ...current, projectTypesText: event.target.value }))
                }
                placeholder="例如：产品工作台、AI 配置中心、前端工程重构、长期协作型 SaaS"
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              />
              <div className="mt-2 text-[11px] leading-5 text-slate-500">
                会写入 User 长期画像中的业务背景，用于帮助主脑理解你最常处理的项目上下文。
              </div>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleResetBootstrap}
                disabled={!bootstrapDirty}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                重置 Bootstrap
              </button>
              <button
                type="button"
                onClick={handleSaveBootstrap}
                disabled={!bootstrapDirty}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {initialized ? '重新初始化并覆盖默认值' : '完成初始化并写入默认值'}
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  };

  const renderMemory = () => (
    <div className="space-y-4">
      <SectionCard title="Memory 工作区" description="这里管理待确认记忆、已确认长期记忆与最近提炼结果，不再把记忆只当成长文本堆叠。">
        <div className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-3">
            {MEMORY_FILTERS.map((item) => {
              const active = memoryFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMemoryFilter(item.id)}
                  className={[
                    'rounded-2xl border px-4 py-3 text-left transition',
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold">{item.title}</div>
                    <InfoPill tone={active ? 'blue' : 'slate'}>
                      {item.id === 'pending'
                        ? pendingMemoryRecords.length
                        : item.id === 'active'
                          ? activeMemoryRecords.length
                          : recentMemoryRecords.length}
                    </InfoPill>
                  </div>
                  <div className={['mt-1 text-[11px] leading-5', active ? 'text-slate-200' : 'text-slate-500'].join(' ')}>
                    {item.caption}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="min-h-0 space-y-3 rounded-3xl border border-slate-200 bg-slate-50/50 p-3">
              {visibleMemoryRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-[12px] leading-6 text-slate-500">
                  当前筛选下没有记忆记录。后续来自会话、任务总结或人工补充的记忆，会在这里进入确认流。
                </div>
              ) : (
                visibleMemoryRecords.map((record) => {
                  const statusMeta = MEMORY_STATUS_META[record.status] || MEMORY_STATUS_META.candidate;
                  const active = selectedMemory?.id === record.id;
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelectedMemoryId(record.id)}
                      className={[
                        'w-full rounded-2xl border px-4 py-3 text-left transition',
                        active
                          ? 'border-slate-900 bg-white shadow-sm'
                          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-[13px] font-semibold text-slate-900">{record.summary}</div>
                        <InfoPill tone={statusMeta.tone}>{statusMeta.label}</InfoPill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] leading-5 text-slate-500">
                        <span>{MEMORY_CATEGORY_LABELS[record.category] || record.category}</span>
                        <span>·</span>
                        <span>{MEMORY_SOURCE_LABELS[record.source] || record.source}</span>
                        {record.topicId ? (
                          <>
                            <span>·</span>
                            <span>{record.topicId}</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              {selectedMemory ? (
                <div className="space-y-4 text-[13px] leading-6 text-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[16px] font-semibold text-slate-900">{selectedMemory.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <InfoPill tone={(MEMORY_STATUS_META[selectedMemory.status] || MEMORY_STATUS_META.candidate).tone}>
                          {(MEMORY_STATUS_META[selectedMemory.status] || MEMORY_STATUS_META.candidate).label}
                        </InfoPill>
                        <InfoPill>{MEMORY_CATEGORY_LABELS[selectedMemory.category] || selectedMemory.category}</InfoPill>
                        <InfoPill>{MEMORY_SOURCE_LABELS[selectedMemory.source] || selectedMemory.source}</InfoPill>
                      </div>
                    </div>
                    <div className="text-[11px] leading-5 text-slate-400">更新于 {formatTime(selectedMemory.updatedAt)}</div>
                  </div>

                  <div className="rounded-2xl bg-slate-50/80 px-4 py-3 text-slate-600">
                    {selectedMemory.detail || '当前没有更详细的记忆说明。'}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div>
                      <div className="font-semibold text-slate-900">证据与来源</div>
                      <div className="mt-2 space-y-2 text-[12px] leading-6 text-slate-600">
                        {selectedMemory.evidence.length > 0 ? (
                          selectedMemory.evidence.map((item, index) => (
                            <div key={`${selectedMemory.id}-evidence-${index}`} className="rounded-2xl bg-slate-50/70 px-3 py-2">
                              {item}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl bg-slate-50/70 px-3 py-2">当前没有记录额外证据。</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">标签与主题</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedMemory.tags.length > 0 ? selectedMemory.tags.map((tag) => <InfoPill key={tag}>{tag}</InfoPill>) : <InfoPill>无标签</InfoPill>}
                        {selectedMemory.topicId ? <InfoPill tone="blue">topic · {selectedMemory.topicId}</InfoPill> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {selectedMemory.status === 'candidate' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDismissMemory(selectedMemory.id)}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          忽略候选
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromoteMemory(selectedMemory.id)}
                          className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          提升为长期记忆
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemory(selectedMemory.id)}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          删除记忆
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDemoteMemory(selectedMemory.id)}
                          className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          降级为待确认
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-[12px] leading-6 text-slate-500">
                  请选择左侧记忆卡片查看来源、证据和操作入口。
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="每日记忆摘要" description="用于沉淀最近自动提炼出的结论性提醒，而不是堆整段原文。">
          <div className="space-y-2 text-[12px] leading-6 text-slate-600">
            {memoryAsset.dailySummary.length > 0 ? (
              memoryAsset.dailySummary.map((item, index) => (
                <div key={`daily-summary-${index}`} className="rounded-2xl bg-slate-50/70 px-3 py-2">
                  {item}
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50/70 px-3 py-2">当前还没有每日记忆摘要。</div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="记忆边界与保留策略" description="控制哪些内容不应长期记住，并展示当前保留上限，避免记忆无限膨胀。">
          <div className="space-y-3 text-[12px] leading-6 text-slate-600">
            <div className="rounded-2xl bg-slate-50/70 px-4 py-3">
              黑名单：
              {memoryAsset.memoryBlacklists.length > 0
                ? memoryAsset.memoryBlacklists.join('；')
                : ' 当前未配置额外记忆黑名单。'}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50/70 px-4 py-3">长期记忆上限：{memoryAsset.retentionPolicy.maxActiveMemories}</div>
              <div className="rounded-2xl bg-slate-50/70 px-4 py-3">候选记忆上限：{memoryAsset.retentionPolicy.maxCandidateMemories}</div>
              <div className="rounded-2xl bg-slate-50/70 px-4 py-3">自动提升阈值：{memoryAsset.retentionPolicy.autoPromoteSimilarCount}</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const renderHeartbeat = () => (
    <div className="space-y-4">
      <SectionCard title="Heartbeat 总控" description="Heartbeat 只负责低频整理与提醒，不是无边界持续自治 agent。这里先控制总开关、全局频率、范围和最近摘要。">
        <div className="space-y-4 text-[13px] leading-6 text-slate-700">
          <div className="grid gap-4 xl:grid-cols-2">
            <ToggleRow
              label="启用 Heartbeat"
              description="开启后，主脑才允许使用这里定义的低频整理任务；关闭时所有任务仅保留配置不执行。"
              checked={heartbeatDraft.enabled}
              onChange={(next) => setHeartbeatDraft((current) => ({ ...current, enabled: next }))}
            />
            <label className="block">
              <div className="font-semibold text-slate-900">全局频率</div>
              <select
                value={heartbeatDraft.cadence}
                onChange={(event) =>
                  setHeartbeatDraft((current) => ({
                    ...current,
                    cadence: event.target.value as StudioMainBrainHeartbeatCadence,
                  }))
                }
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
              >
                <option value="manual">manual</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <div className="font-semibold text-slate-900">作用范围</div>
              <textarea
                value={heartbeatDraft.scopeText}
                onChange={(event) =>
                  setHeartbeatDraft((current) => ({ ...current, scopeText: event.target.value }))
                }
                placeholder="一行一条，例如：memory、workflow、roles"
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              />
            </label>
            <label className="block">
              <div className="font-semibold text-slate-900">最近执行摘要</div>
              <textarea
                value={heartbeatDraft.recentRunSummaryText}
                onChange={(event) =>
                  setHeartbeatDraft((current) => ({
                    ...current,
                    recentRunSummaryText: event.target.value,
                  }))
                }
                placeholder="一行一条，例如：最近没有新的高频失败模式"
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleResetHeartbeat}
              disabled={!heartbeatDirty}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              重置 Heartbeat
            </button>
            <button
              type="button"
              onClick={handleSaveHeartbeat}
              disabled={!heartbeatDirty}
              className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              保存 Heartbeat
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SectionCard title="任务列表" description="这里只允许低频整理、提醒和冲突检查类任务，不接高风险自动发布或无限制搜索。">
          <div className="space-y-3">
            {heartbeatTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-[12px] leading-6 text-slate-500">
                当前还没有 Heartbeat 任务，先从下方模板创建一个低频整理任务。
              </div>
            ) : (
              heartbeatTasks.map((task) => {
                const active = selectedHeartbeatTask?.id === task.id;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedHeartbeatTaskId(task.id)}
                    className={[
                      'w-full rounded-2xl border px-4 py-3 text-left transition',
                      active
                        ? 'border-slate-900 bg-white shadow-sm'
                        : 'border-transparent bg-slate-50/60 hover:border-slate-200 hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-[13px] font-semibold text-slate-900">{task.title}</div>
                      <InfoPill tone={task.enabled ? 'blue' : 'slate'}>
                        {task.enabled ? '已启用' : '已关闭'}
                      </InfoPill>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-slate-500">
                      {HEARTBEAT_TASK_TYPE_LABELS[task.type]} · {task.cadence} · 下次 {formatTime(task.nextRunAt)}
                    </div>
                  </button>
                );
              })
            )}

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">快速添加</div>
              <div className="mt-3 grid gap-2">
                {HEARTBEAT_TASK_TEMPLATES.filter((item) => !heartbeatAsset.heartbeatTasks[`heartbeat-${item.type}`]).map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleCreateHeartbeatTask(item.type)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="text-[12px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-500">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="任务详情" description="支持单任务开关、频率、范围和最近摘要维护，同时明确风险边界。">
          {heartbeatTaskDraft && selectedHeartbeatTask ? (
            <div className="space-y-4 text-[13px] leading-6 text-slate-700">
              <div className="grid gap-4 xl:grid-cols-2">
                <label className="block">
                  <div className="font-semibold text-slate-900">任务名称</div>
                  <input
                    value={heartbeatTaskDraft.title}
                    onChange={(event) =>
                      setHeartbeatTaskDraft((current) =>
                        current ? { ...current, title: event.target.value } : current,
                      )
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <div className="font-semibold text-slate-900">任务类型</div>
                  <select
                    value={heartbeatTaskDraft.type}
                    onChange={(event) =>
                      setHeartbeatTaskDraft((current) =>
                        current
                          ? {
                              ...current,
                              type: event.target.value as StudioMainBrainHeartbeatTaskType,
                            }
                          : current,
                      )
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                  >
                    {HEARTBEAT_TASK_TEMPLATES.map((item) => (
                      <option key={item.type} value={item.type}>
                        {HEARTBEAT_TASK_TYPE_LABELS[item.type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ToggleRow
                  label="启用当前任务"
                  description="关闭后保留配置，但不会被 Heartbeat 调度。"
                  checked={heartbeatTaskDraft.enabled}
                  onChange={(next) =>
                    setHeartbeatTaskDraft((current) =>
                      current ? { ...current, enabled: next } : current,
                    )
                  }
                />
                <label className="block">
                  <div className="font-semibold text-slate-900">任务频率</div>
                  <select
                    value={heartbeatTaskDraft.cadence}
                    onChange={(event) =>
                      setHeartbeatTaskDraft((current) =>
                        current
                          ? {
                              ...current,
                              cadence: event.target.value as StudioMainBrainHeartbeatCadence,
                            }
                          : current,
                      )
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                  >
                    <option value="manual">manual</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <label className="block">
                  <div className="font-semibold text-slate-900">任务范围</div>
                  <textarea
                    value={heartbeatTaskDraft.scopeText}
                    onChange={(event) =>
                      setHeartbeatTaskDraft((current) =>
                        current ? { ...current, scopeText: event.target.value } : current,
                      )
                    }
                    placeholder="一行一条，例如：memory、workflow"
                    className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <div className="font-semibold text-slate-900">最近任务摘要</div>
                  <textarea
                    value={heartbeatTaskDraft.lastSummary}
                    onChange={(event) =>
                      setHeartbeatTaskDraft((current) =>
                        current ? { ...current, lastSummary: event.target.value } : current,
                      )
                    }
                    placeholder="例如：最近没有新的规则冲突"
                    className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] leading-6 text-amber-800">
                <div className="font-semibold">风险边界</div>
                <div className="mt-1">Heartbeat 只允许低频整理、提醒与检查，不允许无限制联网搜索、无用户确认的高风险发布、无边界更新长期关键资产。</div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDeleteHeartbeatTask}
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                >
                  删除任务
                </button>
                <button
                  type="button"
                  onClick={handleResetHeartbeatTask}
                  disabled={!heartbeatTaskDirty}
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  重置任务
                </button>
                <button
                  type="button"
                  onClick={handleSaveHeartbeatTask}
                  disabled={!heartbeatTaskDirty}
                  className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  保存任务
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-[12px] leading-6 text-slate-500">
              先从左侧选择一个 Heartbeat 任务，或使用快速添加创建初始任务。
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeSection) {
      case 'bootstrap':
        return renderBootstrap();
      case 'heartbeat':
        return renderHeartbeat();
      case 'memory':
        return renderMemory();
      case 'soul':
        return renderSoul();
      case 'user':
        return renderUser();
      case 'workflow':
        return renderWorkflow();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  const renderSidePanel = () => {
    if (activeSection === 'overview') {
      return (
        <div className="space-y-4">
          <SectionCard title="运行时注入预览" description="这里展示当前已保存配置进入运行时后的共享提示词块。" tone="slate">
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-700">
              {getMainBrainPreferenceBlock() || '当前还没有额外主脑共享摘要。'}
            </pre>
          </SectionCard>
          <SectionCard title="影响范围" description="Overview 只负责摘要与入口，不直接承载大段全文。">
            <div className="space-y-2 text-[12px] leading-6 text-slate-600">
              <div>· 所有角色都会继承这里保存的长期主脑配置。</div>
              <div>· 共享补充层会与结构化 Soul / User / Workflow 一起注入运行时。</div>
              <div>· Memory / Heartbeat / Audit 后续会下沉到独立分区，不继续堆在首页。</div>
            </div>
          </SectionCard>
          <SectionCard title="系统基线" description="保留默认长期规则，方便判断哪些是系统默认、哪些是用户增量。">
            <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-700">
              {legacyPreferenceDefaultText || '当前没有额外默认基线。'}
            </pre>
          </SectionCard>
        </div>
      );
    }

    const panelMap: Record<Exclude<MainBrainSectionId, 'overview'>, { preview: string; title: string; desc: string; updatedAt: number }> = {
      bootstrap: {
        preview: bootstrapPreview,
        title: 'Bootstrap 输出预览',
        desc: '这里展示问卷选择会生成的默认配置摘要，落库后会覆盖 Soul / User / Workflow 当前默认值。',
        updatedAt: bootstrapAsset.updatedAt,
      },
      soul: {
        preview: soulPreview,
        title: 'Soul 注入摘要预览',
        desc: '会影响主脑在规划、表达、风险判断时的长期人格。',
        updatedAt: soulAsset.updatedAt,
      },
      user: {
        preview: userPreview,
        title: 'User 注入摘要预览',
        desc: '会影响主脑对用户本人目标、习惯、背景的长期理解。',
        updatedAt: userAsset.updatedAt,
      },
      workflow: {
        preview: workflowPreview,
        title: 'Workflow 注入摘要预览',
        desc: '会影响分析深度、联网搜索、澄清优先级和默认治理策略。',
        updatedAt: workflowAsset.updatedAt,
      },
      memory: {
        preview: memoryPreview,
        title: 'Memory 运行时摘要预览',
        desc: '这里展示当前长期记忆进入运行时前的摘要形态，重点关注已确认记忆、待确认数量与边界提醒。',
        updatedAt: memoryAsset.updatedAt,
      },
      heartbeat: {
        preview: heartbeatPreview,
        title: 'Heartbeat 运行时摘要预览',
        desc: '这里展示 Heartbeat 的全局启用状态、任务频率、最近摘要与当前聚焦任务，用于确保它仍是低频可控能力。',
        updatedAt: heartbeatAsset.updatedAt,
      },
    };

    const panel = panelMap[activeSection as Exclude<MainBrainSectionId, 'overview'>];
    return (
      <div className="space-y-4">
        <SectionCard title={panel.title} description={panel.desc} tone="slate">
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-700">
            {panel.preview || '当前分区还没有可预览的结构化摘要。'}
          </pre>
        </SectionCard>
        <SectionCard title="变更信息" description="帮助确认当前编辑会影响什么，以及上次持久化发生在什么时候。">
          <div className="space-y-2 text-[12px] leading-6 text-slate-600">
            <div>最近保存：{formatTime(panel.updatedAt)}</div>
            <div>运行时生效方式：准备执行任务时统一注入 prompt 层。</div>
            <div>风险提醒：避免在这里堆长篇原文，优先存可摘要、可执行的规则。</div>
          </div>
        </SectionCard>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/40 p-4">
      <button
        type="button"
        aria-label="关闭主脑配置中心"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-[146] flex max-h-[min(88vh,920px)] w-[min(1320px,100%)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Lightbulb size={18} className="text-amber-500" />
              <h3 className="text-[20px] font-semibold text-slate-900">主脑配置中心</h3>
              <InfoPill tone="blue">Phase 1</InfoPill>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-500">
              长期规则、用户画像、工作策略与运行状态摘要在这里统一管理，避免继续把复杂编辑堆在输入区。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InfoPill>最近更新 {formatTime(latestUpdatedAt)}</InfoPill>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-6 py-5 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
          <aside className="min-h-0 overflow-y-auto">
            <div className="rounded-3xl border border-slate-200 bg-white p-3">
              <div className="px-2 pb-3 pt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                当前分区
              </div>
              <div className="space-y-2">
                {PRIMARY_SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={[
                        'w-full rounded-2xl border px-3 py-3 text-left transition',
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} className={active ? 'text-slate-100' : 'text-slate-400'} />
                        <span className="text-[13px] font-semibold">{item.title}</span>
                      </div>
                      <div
                        className={[
                          'mt-1 text-[11px] leading-5',
                          active ? 'text-slate-200' : 'text-slate-500',
                        ].join(' ')}
                      >
                        {item.caption}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                下一阶段
              </div>
              <div className="mt-3 space-y-2 text-[12px] leading-5 text-slate-500">
                {FUTURE_SECTIONS.map((item) => (
                  <div key={item} className="rounded-2xl bg-white/80 px-3 py-2">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto pr-1">{renderMainContent()}</main>

          <aside className="min-h-0 overflow-y-auto pr-1">{renderSidePanel()}</aside>
        </div>
      </div>
    </div>
  );
};
