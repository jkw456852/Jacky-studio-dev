import { createClient } from '@supabase/supabase-js';
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

const createEmptyState = (): StudioUserAssetState => ({
  version: 3,
  updatedAt: Date.now(),
  mainBrainPreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    lines: [],
  },
  userProfile: {
    schemaVersion: 1,
    updatedAt: Date.now(),
    preferenceNotes: [],
    commonTasks: [],
    aestheticPreferences: [],
    brandContextNotes: [],
    memoryNotes: [],
  },
  workspacePreferences: {
    schemaVersion: 1,
    updatedAt: Date.now(),
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
  styleLibraries: {},
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

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing server Supabase env. Please set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
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
    throw error;
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
    throw error;
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
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = readBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: authError?.message || 'Invalid auth token' });
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
    console.error('[account-sync] request failed', error);
    return res.status(500).json({ error: error?.message || 'account_sync_failed' });
  }
}
