import React from 'react';
import {
  Brain,
  ChevronDown,
  Compass,
  Database,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { StudioUserAssetApi } from '../../../services/runtime-assets/api';
import { getMainBrainPreferenceBlock } from '../../../services/runtime-assets/main-brain.ts';
import type {
  StudioMainBrainHeartbeatAsset,
  StudioMainBrainSearchPolicy,
  StudioMainBrainSoulAsset,
  StudioMainBrainUserAsset,
  StudioMainBrainWorkflowAsset,
} from '../../../services/runtime-assets/user-asset-types.ts';

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

type ResponseStylePreset = 'concise' | 'balanced' | 'strategic';
type ExecutionModePreset = 'ask-first' | 'balanced' | 'move-fast';
type CreativityPreset = 'stable' | 'balanced' | 'explore';

type PreferenceDraft = {
  assistantIdentity: string;
  responseStyle: ResponseStylePreset;
  executionMode: ExecutionModePreset;
  researchMode: StudioMainBrainSearchPolicy;
  creativityMode: CreativityPreset;
  businessContextText: string;
  visualTasteText: string;
  permanentNotesText: string;
  memoryGuardrailsText: string;
  heartbeatEnabled: boolean;
  heartbeatCadence: StudioMainBrainHeartbeatAsset['cadence'];
};

const splitLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinLines = (values: string[]): string => values.join('\n');

const normalizeDraft = (draft: PreferenceDraft) => ({
  ...draft,
  assistantIdentity: draft.assistantIdentity.trim(),
  businessContextText: draft.businessContextText.trim(),
  visualTasteText: draft.visualTasteText.trim(),
  permanentNotesText: draft.permanentNotesText.trim(),
  memoryGuardrailsText: draft.memoryGuardrailsText.trim(),
});

const detectResponseStyle = (
  soul: StudioMainBrainSoulAsset,
  user: StudioMainBrainUserAsset,
): ResponseStylePreset => {
  const text = [
    soul.persona,
    ...soul.tone,
    ...user.communicationStyle,
  ]
    .join('\n')
    .toLowerCase();
  if (/(结论先行|直接|简洁|克制|concise|direct)/i.test(text)) return 'concise';
  if (/(策略|结构化|系统性|框架|strategic|structured)/i.test(text)) return 'strategic';
  return 'balanced';
};

const detectExecutionMode = (
  soul: StudioMainBrainSoulAsset,
  workflow: StudioMainBrainWorkflowAsset,
): ExecutionModePreset => {
  if (workflow.clarifyBeforeExecution && soul.riskPreference === 'conservative') {
    return 'ask-first';
  }
  if (!workflow.clarifyBeforeExecution && soul.riskPreference === 'aggressive') {
    return 'move-fast';
  }
  return 'balanced';
};

const detectCreativityMode = (
  soul: StudioMainBrainSoulAsset,
  workflow: StudioMainBrainWorkflowAsset,
): CreativityPreset => {
  if (soul.riskPreference === 'conservative' || workflow.defaultAnalysisDepth === 'light') {
    return 'stable';
  }
  if (soul.riskPreference === 'aggressive' || workflow.defaultAnalysisDepth === 'deep') {
    return 'explore';
  }
  return 'balanced';
};

const buildDraft = (args: {
  soul: StudioMainBrainSoulAsset;
  user: StudioMainBrainUserAsset;
  workflow: StudioMainBrainWorkflowAsset;
  heartbeat: StudioMainBrainHeartbeatAsset;
}): PreferenceDraft => ({
  assistantIdentity: args.soul.persona,
  responseStyle: detectResponseStyle(args.soul, args.user),
  executionMode: detectExecutionMode(args.soul, args.workflow),
  researchMode: args.workflow.searchPolicy,
  creativityMode: detectCreativityMode(args.soul, args.workflow),
  businessContextText: joinLines(args.user.businessContext),
  visualTasteText: joinLines(args.user.aestheticPreferences),
  permanentNotesText: joinLines(args.user.permanentNotes),
  memoryGuardrailsText: joinLines(args.user.memoryBlacklist),
  heartbeatEnabled: args.heartbeat.enabled,
  heartbeatCadence: args.heartbeat.cadence,
});

const responseStyleToTone = (value: ResponseStylePreset): string[] => {
  switch (value) {
    case 'concise':
      return ['直接', '结论先行', '少废话'];
    case 'strategic':
      return ['结构化', '有判断', '强调取舍'];
    default:
      return ['清晰', '自然', '专业'];
  }
};

const responseStyleToCommunication = (value: ResponseStylePreset): string[] => {
  switch (value) {
    case 'concise':
      return ['中文直达结论', '避免铺垫'];
    case 'strategic':
      return ['先给判断再解释原因', '保留必要上下文'];
    default:
      return ['结论与解释平衡', '保持可执行性'];
  }
};

const executionModeToWorkingStyle = (value: ExecutionModePreset): string[] => {
  switch (value) {
    case 'ask-first':
      return ['遇到歧义先澄清', '优先降低误执行'];
    case 'move-fast':
      return ['默认先推进', '优先把结果做出来再修正'];
    default:
      return ['先判断再执行', '尽量减少来回确认'];
  }
};

const creativityModeToRiskPreference = (
  value: CreativityPreset,
): StudioMainBrainSoulAsset['riskPreference'] => {
  switch (value) {
    case 'stable':
      return 'conservative';
    case 'explore':
      return 'aggressive';
    default:
      return 'balanced';
  }
};

const creativityModeToAnalysisDepth = (
  value: CreativityPreset,
): StudioMainBrainWorkflowAsset['defaultAnalysisDepth'] => {
  switch (value) {
    case 'stable':
      return 'light';
    case 'explore':
      return 'deep';
    default:
      return 'balanced';
  }
};

const PanelShell: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, description, children }) => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)]">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-slate-500">{description}</div>
      </div>
    </div>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

const ChoiceGroup: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; title: string; description: string }>;
}> = ({ label, value, onChange, options }) => (
  <div className="space-y-2">
    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="grid gap-3 md:grid-cols-3">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'rounded-2xl border px-4 py-3 text-left transition',
              selected
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-white',
            ].join(' ')}
          >
            <div className="text-[13px] font-semibold">{option.title}</div>
            <div className={[
              'mt-1 text-[11px] leading-5',
              selected ? 'text-slate-200' : 'text-slate-500',
            ].join(' ')}>
              {option.description}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const TextAreaField: React.FC<{
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minHeight?: string;
}> = ({ label, description, value, onChange, placeholder, minHeight = '120px' }) => (
  <label className="block">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[13px] font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-[12px] leading-5 text-slate-500">{description}</div>
      </div>
    </div>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
      style={{ minHeight }}
    />
  </label>
);

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
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
  const readCurrentDraft = React.useCallback(
    () =>
      buildDraft({
        soul: userAssetApi.getMainBrainSoul(),
        user: userAssetApi.getMainBrainUser(),
        workflow: userAssetApi.getMainBrainWorkflow(),
        heartbeat: userAssetApi.getMainBrainHeartbeat(),
      }),
    [userAssetApi],
  );

  const [draft, setDraft] = React.useState<PreferenceDraft>(() => readCurrentDraft());
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  React.useEffect(() => {
    setDraft(readCurrentDraft());
  }, [readCurrentDraft, revision]);

  const currentSoul = userAssetApi.getMainBrainSoul();
  const currentUser = userAssetApi.getMainBrainUser();
  const currentWorkflow = userAssetApi.getMainBrainWorkflow();
  const currentMemory = userAssetApi.getMainBrainMemory();
  const currentHeartbeat = userAssetApi.getMainBrainHeartbeat();

  const normalizedDraft = React.useMemo(() => normalizeDraft(draft), [draft]);
  const normalizedCurrentDraft = React.useMemo(
    () => normalizeDraft(readCurrentDraft()),
    [readCurrentDraft, revision],
  );
  const panelDirty = JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedCurrentDraft);

  const handleResetPanel = React.useCallback(() => {
    setDraft(readCurrentDraft());
  }, [readCurrentDraft]);

  const handleSavePanel = React.useCallback(() => {
    userAssetApi.setMainBrainSoul({
      persona: normalizedDraft.assistantIdentity,
      tone: responseStyleToTone(normalizedDraft.responseStyle),
      workingStyle: executionModeToWorkingStyle(normalizedDraft.executionMode),
      riskPreference: creativityModeToRiskPreference(normalizedDraft.creativityMode),
    });
    userAssetApi.setMainBrainUser({
      businessContext: splitLines(normalizedDraft.businessContextText),
      aestheticPreferences: splitLines(normalizedDraft.visualTasteText),
      communicationStyle: responseStyleToCommunication(normalizedDraft.responseStyle),
      permanentNotes: splitLines(normalizedDraft.permanentNotesText),
      memoryBlacklist: splitLines(normalizedDraft.memoryGuardrailsText),
    });
    userAssetApi.setMainBrainWorkflow({
      defaultAnalysisDepth: creativityModeToAnalysisDepth(normalizedDraft.creativityMode),
      searchPolicy: normalizedDraft.researchMode,
      clarifyBeforeExecution: normalizedDraft.executionMode === 'ask-first',
    });
    userAssetApi.setMainBrainHeartbeat({
      enabled: normalizedDraft.heartbeatEnabled,
      cadence: normalizedDraft.heartbeatCadence,
    });
    onSaved();
  }, [normalizedDraft, onSaved, userAssetApi]);

  const preferencePreview = React.useMemo(
    () =>
      getMainBrainPreferenceBlock()
        .split('\n')
        .slice(0, 18)
        .join('\n'),
    [revision],
  );

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/36 p-4 backdrop-blur-[4px]">
      <button type="button" aria-label="close agent preferences" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-[141] flex max-h-[min(88vh,920px)] w-[min(1120px,100%)] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-[#f7f8fb] shadow-[0_30px_90px_-28px_rgba(15,23,42,0.42)]">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Long-term Preferences
              </div>
              <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-slate-950">
                长期偏好
              </h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-500">
                这里只保留用户能稳定感知结果差异的少数设置。复杂治理、低频整理和内部 Agent 结构不再作为主操作面暴露。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">当前风格</div>
              <div className="mt-2 text-[14px] font-semibold text-slate-900">{currentSoul.persona || '未设置'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">搜索策略</div>
              <div className="mt-2 text-[14px] font-semibold text-slate-900">{currentWorkflow.searchPolicy}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">长期记忆</div>
              <div className="mt-2 text-[14px] font-semibold text-slate-900">{currentMemory.memoryIndex.length} 条已确认</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">自动整理</div>
              <div className="mt-2 text-[14px] font-semibold text-slate-900">
                {currentHeartbeat.enabled ? `已开启 · ${currentHeartbeat.cadence}` : '未开启'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-6">
              <PanelShell
                icon={Brain}
                title="工作方式"
                description="决定 Agent 平时怎么说、怎么搜、执行前有多谨慎。"
              >
                <TextAreaField
                  label="你希望它像什么样的搭档"
                  description="这是最直接的长期设定，会影响 Agent 人格和默认语气。"
                  value={draft.assistantIdentity}
                  onChange={(value) => setDraft((current) => ({ ...current, assistantIdentity: value }))}
                  placeholder="例如：冷静、克制、会先判断再落地的设计协作搭档。"
                  minHeight="92px"
                />
                <ChoiceGroup
                  label="回答风格"
                  value={draft.responseStyle}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, responseStyle: value as ResponseStylePreset }))
                  }
                  options={[
                    {
                      value: 'concise',
                      title: '直接简洁',
                      description: '结论先行，少解释，适合高频操作。',
                    },
                    {
                      value: 'balanced',
                      title: '平衡清晰',
                      description: '结论和解释都保留，适合日常协作。',
                    },
                    {
                      value: 'strategic',
                      title: '策略型',
                      description: '更强调取舍、结构和方案判断。',
                    },
                  ]}
                />
                <ChoiceGroup
                  label="执行方式"
                  value={draft.executionMode}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, executionMode: value as ExecutionModePreset }))
                  }
                  options={[
                    {
                      value: 'ask-first',
                      title: '先确认再动',
                      description: '适合高风险修改，先问清再执行。',
                    },
                    {
                      value: 'balanced',
                      title: '判断后推进',
                      description: '能自己判断的先做，关键点再确认。',
                    },
                    {
                      value: 'move-fast',
                      title: '快速推进',
                      description: '优先先做出来，之后再按反馈细修。',
                    },
                  ]}
                />
                <ChoiceGroup
                  label="联网策略"
                  value={draft.researchMode}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, researchMode: value as StudioMainBrainSearchPolicy }))
                  }
                  options={[
                    {
                      value: 'never',
                      title: '默认不搜',
                      description: '优先基于当前上下文处理。',
                    },
                    {
                      value: 'auto',
                      title: '按需搜索',
                      description: '遇到不确定信息时再联网。',
                    },
                    {
                      value: 'prefer',
                      title: '优先搜索',
                      description: '更倾向先补足外部信息再回答。',
                    },
                  ]}
                />
              </PanelShell>

              <PanelShell
                icon={Sparkles}
                title="创作偏好"
                description="把抽象的内部 Agent 参数收敛成真正能感知结果的创作偏好。"
              >
                <ChoiceGroup
                  label="创作倾向"
                  value={draft.creativityMode}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, creativityMode: value as CreativityPreset }))
                  }
                  options={[
                    {
                      value: 'stable',
                      title: '稳一点',
                      description: '优先保留结构、少冒险，适合还原和修修补补。',
                    },
                    {
                      value: 'balanced',
                      title: '平衡',
                      description: '既保留结构，又允许合理探索。',
                    },
                    {
                      value: 'explore',
                      title: '更敢试',
                      description: '允许更强的探索和更深的推演。',
                    },
                  ]}
                />
                <TextAreaField
                  label="视觉偏好"
                  description="只写稳定长期偏好，比如版式、留白、质感、节奏，不要写某一次具体任务。"
                  value={draft.visualTasteText}
                  onChange={(value) => setDraft((current) => ({ ...current, visualTasteText: value }))}
                  placeholder="例如：克制、清爽、留白多、层级清楚，避免廉价电商味。"
                />
              </PanelShell>

              <PanelShell
                icon={Compass}
                title="长期背景"
                description="把高频背景和协作约束收成少量长期信息，避免每次都重复说。"
              >
                <TextAreaField
                  label="业务背景"
                  description="告诉 Agent 你现在主要在做什么类型的项目或产品。"
                  value={draft.businessContextText}
                  onChange={(value) => setDraft((current) => ({ ...current, businessContextText: value }))}
                  placeholder="例如：这是一个带画布、工作流和侧边栏智能体的设计工作台。"
                />
                <TextAreaField
                  label="长期备注"
                  description="放那些你希望它长期记住的协作习惯或边界。"
                  value={draft.permanentNotesText}
                  onChange={(value) => setDraft((current) => ({ ...current, permanentNotesText: value }))}
                  placeholder="例如：不要只看 UI，要追到底层链路是否真的接通。"
                />
              </PanelShell>

              <PanelShell
                icon={Database}
                title="记忆与高级"
                description="只保留一个用户真正能理解的记忆边界，复杂内存治理收回系统内部。"
              >
                <TextAreaField
                  label="不要长期记住什么"
                  description="一行一条，适合放一次性临时要求或你不想被固化成长期偏好的内容。"
                  value={draft.memoryGuardrailsText}
                  onChange={(value) => setDraft((current) => ({ ...current, memoryGuardrailsText: value }))}
                  placeholder="例如：一次性的临时举例、当天随口试探的方案。"
                />
                <ToggleRow
                  label="自动整理长期偏好"
                  description="当前版本只做轻量整理与摘要，不代表完整的后台调度系统。"
                  checked={draft.heartbeatEnabled}
                  onChange={(value) => setDraft((current) => ({ ...current, heartbeatEnabled: value }))}
                />
                {draft.heartbeatEnabled ? (
                  <ChoiceGroup
                    label="整理频率"
                    value={draft.heartbeatCadence}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        heartbeatCadence: value as StudioMainBrainHeartbeatAsset['cadence'],
                      }))
                    }
                    options={[
                      {
                        value: 'manual',
                        title: '手动',
                        description: '只在明确触发或关键节点整理。',
                      },
                      {
                        value: 'daily',
                        title: '每日',
                        description: '适合高频使用、持续迭代的项目。',
                      },
                      {
                        value: 'weekly',
                        title: '每周',
                        description: '适合低频但需要保留长期脉络。',
                      },
                    ]}
                  />
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">实验室与补充规则</div>
                      <div className="mt-1 text-[12px] leading-5 text-slate-500">
                        保留给高级用户的小范围长期补充，不再承担“系统控制台”职责。
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={[
                        'shrink-0 text-slate-400 transition-transform',
                        showAdvanced ? 'rotate-180' : '',
                      ].join(' ')}
                    />
                  </button>

                  {showAdvanced ? (
                    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                      <TextAreaField
                        label="补充规则"
                        description="这里适合写少量长期约束。复杂规则不要堆在这里。"
                        value={legacyPreferenceDraft}
                        onChange={onLegacyPreferenceDraftChange}
                        placeholder="例如：改代码前先确认是否仍然符合 assistant-ui / AI SDK 官方接法。"
                        minHeight="160px"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                        <div>当前已保存 {legacyPreferenceStoredCount} 条补充规则。</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onLegacyPreferenceDraftChange(legacyPreferenceDefaultText)}
                            className="rounded-full border border-slate-200 px-4 py-1.5 font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            恢复建议基线
                          </button>
                          <button
                            type="button"
                            onClick={onResetLegacyPreferences}
                            disabled={legacyPreferenceStoredCount === 0 && !legacyPreferenceDraft.trim()}
                            className="rounded-full border border-slate-200 px-4 py-1.5 font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            清空
                          </button>
                          <button
                            type="button"
                            onClick={onSaveLegacyPreferences}
                            disabled={!legacyPreferenceDirty}
                            className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            保存补充规则
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </PanelShell>
            </div>

            <div className="space-y-6">
              <PanelShell
                icon={SlidersHorizontal}
                title="当前会写进 Agent 的摘要"
                description="这是当前偏好在 Agent 里的实际摘要片段，方便判断它到底会如何被解释。"
              >
                <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 px-4 py-4 text-[11px] leading-5 text-slate-200">{preferencePreview}</pre>
              </PanelShell>

              <PanelShell
                icon={Search}
                title="产品化原则"
                description="这块界面现在遵循更成熟的设计网站智能体侧边栏思路。"
              >
                <ul className="space-y-2 text-[12px] leading-6 text-slate-600">
                  <li>只暴露用户能稳定感知差异的少数设置。</li>
                  <li>把复杂治理、任务调度和 Agent 内部结构收回系统内部。</li>
                  <li>优先保留长期偏好、创作倾向、执行方式和记忆边界。</li>
                  <li>减少“像开关但其实只是 prompt 软约束”的误导性配置。</li>
                </ul>
              </PanelShell>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] leading-5 text-slate-500">
              未展示的复杂内部资产会继续保留在底层，不再作为用户主操作面出现。
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResetPanel}
                disabled={!panelDirty}
                className="rounded-full border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                恢复当前
              </button>
              <button
                type="button"
                onClick={handleSavePanel}
                disabled={!panelDirty}
                className="rounded-full bg-slate-900 px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                保存长期偏好
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
