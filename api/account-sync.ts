import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type {
  StudioUserAssetAuditEntry,
  StudioUserAssetState,
} from '../services/runtime-assets/user-asset-types.ts';

type RemoteEnvelope = {
  snapshot: StudioUserAssetState;
  auditEntries: StudioUserAssetAuditEntry[];
};

type AccountSyncRow = {
  user_id: string;
  snapshot: StudioUserAssetState;
  audit_entries: StudioUserAssetAuditEntry[];
  created_at?: string;
  updated_at?: string;
};

const TABLE_NAME = 'studio_user_assets';

type AccountSyncApiError = Error & {
  status: number;
  code: string;
  details?: Record<string, unknown>;
};

const createAccountSyncApiError = (
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): AccountSyncApiError => {
  const error = new Error(message) as AccountSyncApiError;
  error.name = 'AccountSyncApiError';
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const readAccountSyncErrorRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

const readAccountSyncErrorMessage = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  const record = readAccountSyncErrorRecord(value);
  return typeof record.message === 'string' ? record.message.trim() : '';
};

const isInvalidSupabaseServerKeyError = (value: unknown): boolean => {
  const record = readAccountSyncErrorRecord(value);
  const code = String(record.code || '').trim().toLowerCase();
  const message = readAccountSyncErrorMessage(value).toLowerCase();
  return (
    code === 'invalid_api_key'
    || message.includes('invalid api key')
    || message.includes('no api key found')
  );
};

const isMissingAccountSyncTableError = (value: unknown): boolean => {
  const record = readAccountSyncErrorRecord(value);
  const code = String(record.code || '').trim().toUpperCase();
  const message = readAccountSyncErrorMessage(value).toLowerCase();
  return (
    code === '42P01'
    || code === 'PGRST205'
    || (
      message.includes(TABLE_NAME)
      && (
        message.includes('does not exist')
        || message.includes('schema cache')
        || message.includes('could not find')
      )
    )
  );
};

export const classifyAccountSyncServerError = (
  value: unknown,
): AccountSyncApiError => {
  if (
    value
    && typeof value === 'object'
    && typeof (value as Partial<AccountSyncApiError>).status === 'number'
    && typeof (value as Partial<AccountSyncApiError>).code === 'string'
  ) {
    return value as AccountSyncApiError;
  }

  if (isInvalidSupabaseServerKeyError(value)) {
    return createAccountSyncApiError(
      503,
      'account_sync_service_key_invalid',
      'Supabase 服务端密钥无效或不属于当前项目，请更新 Vercel 的 SUPABASE_SERVICE_ROLE_KEY。',
    );
  }

  if (isMissingAccountSyncTableError(value)) {
    return createAccountSyncApiError(
      503,
      'account_sync_table_missing',
      '账户资产存储尚未初始化，请先执行 Supabase migration。',
      {
        table: TABLE_NAME,
        migration: 'supabase/migrations/202607150000_create_studio_user_assets.sql',
      },
    );
  }

  const record = readAccountSyncErrorRecord(value);
  const providerCode = String(record.code || '').trim();
  if (providerCode) {
    return createAccountSyncApiError(
      502,
      'account_sync_database_failed',
      'Supabase 账户资产存储请求失败。',
      {
        providerCode,
        providerMessage: readAccountSyncErrorMessage(value),
      },
    );
  }

  return createAccountSyncApiError(
    500,
    'account_sync_failed',
    readAccountSyncErrorMessage(value) || '账户资产同步失败。',
  );
};

const createEmptyState = (): StudioUserAssetState => ({
  version: 5,
  updatedAt: Date.now(),
  mainBrainPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    lines: [],
  },
  mainBrainSoul: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    persona: '',
    tone: [],
    workingStyle: [],
    restraintRules: [],
    selfCheckRules: [],
    riskPreference: 'balanced',
  },
  mainBrainUser: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    goals: [],
    workingHabits: [],
    businessContext: [],
    aestheticPreferences: [],
    communicationStyle: [],
    permanentNotes: [],
    memoryBlacklist: [],
  },
  mainBrainWorkflow: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    defaultAnalysisDepth: 'balanced',
    searchPolicy: 'auto',
    clarifyBeforeExecution: false,
    toolUseGuidelines: [],
    failureRecoveryRules: [],
    roleGovernanceDefaults: {
      mode: 'approval_required',
      allowDraft: true,
      allowAutoPromote: false,
      allowAutoArchive: false,
    },
  },
  mainBrainMemory: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    memoryIndex: [],
    memoryRecords: {},
    pendingMemoryCandidates: [],
    memoryBlacklists: [],
    retentionPolicy: {
      maxActiveMemories: 200,
      maxCandidateMemories: 50,
      autoPromoteSimilarCount: 3,
    },
    dailySummary: [],
  },
  mainBrainHeartbeat: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    enabled: false,
    cadence: 'manual',
    scope: [],
    heartbeatTasks: {},
    recentRunSummary: [],
    lastRunAt: null,
    nextRunAt: null,
  },
  mainBrainBootstrap: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    initialized: false,
    initializedAt: null,
    sourceTemplate: '',
    completedSteps: [],
    lastRebootstrapAt: null,
  },
  userProfile: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    avatarUrl: '',
    preferenceNotes: [],
    commonTasks: [],
    aestheticPreferences: [],
    brandContextNotes: [],
    memoryNotes: [],
  },
  workspacePreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    chatModelMode: 'fast',
    chatWebEnabled: false,
    selectedScriptModels: ['gemini-3.1-flash-lite-preview'],
    selectedImageModels: ['Auto'],
    selectedVideoModels: ['veo-3.1-fast-generate-preview'],
    imageModelPostPaths: {},
    visualOrchestratorModel: 'auto',
    browserAgentModel: 'auto',
    visualOrchestratorMaxReferenceImages: 0,
    visualOrchestratorMaxInlineImageBytesMb: 48,
    visualContinuity: true,
    systemModeration: false,
    autoSave: true,
    concurrentCount: 1,
    autoModelSelect: true,
    preferredImageModel: 'Nano Banana Pro',
    preferredImageProviderId: null,
    preferredVideoModel: 'veo-3.1-fast-generate-preview',
    preferredVideoProviderId: null,
    preferred3DModel: 'Auto',
    browserAgentChatEnabled: true,
  },
  skillPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    activeQuickSkill: null,
    recentSkillIds: [],
    pinnedSkillIds: [],
    customSkillConfigs: {},
  },
  pluginPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    records: {},
  },
  agentPromptAddons: {},
  latestRoleDrafts: {},
  roles: {},
  temporaryRoleDrafts: {},
  roleVersions: {},
  roleAuditEntries: {},
  styleLibraries: {},
  styleLibraryCandidates: {},
  evolutionRecords: {},
});

const createEmptyEnvelope = (): RemoteEnvelope => ({
  snapshot: createEmptyState(),
  auditEntries: [],
});

const readBearerToken = (req: any): string => {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const readBody = (req: any): any => {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
};

const getServerSupabase = () => {
  const supabaseUrl = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  ).trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const missingEnv = [
    ...(!supabaseUrl ? ['SUPABASE_URL (or VITE_SUPABASE_URL)'] : []),
    ...(!serviceRoleKey ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
  ];

  if (missingEnv.length > 0) {
    throw createAccountSyncApiError(
      503,
      'account_sync_server_env_missing',
      `Vercel 缺少账户同步所需的服务端环境变量：${missingEnv.join(', ')}。`,
      { missingEnv },
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const readRemoteEnvelope = async (supabase: any, userId: string) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('snapshot, audit_entries')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw classifyAccountSyncServerError(error);
  }

  const row = (data || null) as AccountSyncRow | null;

  if (!row) {
    return createEmptyEnvelope();
  }

  return {
    snapshot: row.snapshot || createEmptyState(),
    auditEntries: Array.isArray(row.audit_entries) ? row.audit_entries : [],
  } satisfies RemoteEnvelope;
};

const writeRemoteEnvelope = async (
  supabase: any,
  userId: string,
  envelope: RemoteEnvelope,
) => {
  const payload: AccountSyncRow = {
    user_id: userId,
    snapshot: envelope.snapshot,
    audit_entries: envelope.auditEntries,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert([payload], {
      onConflict: 'user_id',
    })
    .select('snapshot, audit_entries')
    .single();

  if (error) {
    throw classifyAccountSyncServerError(error);
  }

  const row = (data || null) as AccountSyncRow | null;

  return {
    snapshot: row?.snapshot || envelope.snapshot,
    auditEntries: Array.isArray(row?.audit_entries)
      ? row.audit_entries
      : envelope.auditEntries,
  } satisfies RemoteEnvelope;
};

export default async function handler(req: any, res: any) {
  const requestId = randomUUID().slice(0, 8);
  res.setHeader?.('x-account-sync-request-id', requestId);

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'method_not_allowed',
      requestId,
    });
  }

  try {
    const token = readBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Missing bearer token',
        code: 'missing_bearer_token',
        requestId,
      });
    }

    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError && isInvalidSupabaseServerKeyError(authError)) {
      throw classifyAccountSyncServerError(authError);
    }

    if (authError || !user) {
      return res.status(401).json({
        error: authError?.message || 'Invalid auth token',
        code: 'invalid_auth_token',
        requestId,
      });
    }

    if (req.method === 'GET') {
      const envelope = await readRemoteEnvelope(supabase, user.id);
      return res.status(200).json(envelope);
    }

    const body = readBody(req);
    const nextSnapshot = body?.snapshot && typeof body.snapshot === 'object'
      ? (body.snapshot as StudioUserAssetState)
      : createEmptyState();
    const nextAuditEntries = Array.isArray(body?.auditEntries)
      ? (body.auditEntries as StudioUserAssetAuditEntry[])
      : [];

    const envelope = await writeRemoteEnvelope(supabase, user.id, {
      snapshot: nextSnapshot,
      auditEntries: nextAuditEntries,
    });

    return res.status(200).json(envelope);
  } catch (error: any) {
    const apiError = classifyAccountSyncServerError(error);
    console.error('[account-sync] request failed', {
      requestId,
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      cause: error,
    });
    return res.status(apiError.status).json({
      error: apiError.message,
      code: apiError.code,
      requestId,
      ...(apiError.details ? { details: apiError.details } : {}),
    });
  }
}
