import { createClient } from '@supabase/supabase-js';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  createEmptyAccountSecretsSnapshot,
  normalizeAccountSecretsSnapshot,
  type StudioAccountSecretsSnapshot,
} from '../services/account-secrets.ts';

type AccountSecretsCipherEnvelope = {
  version: 1;
  keyVersion: string;
  algorithm: 'aes-256-gcm';
  iv: string;
  ciphertext: string;
  authTag: string;
};

type AccountSecretsRow = {
  user_id: string;
  encrypted_payload: AccountSecretsCipherEnvelope | null;
  created_at?: string;
  updated_at?: string;
};

const TABLE_NAME = 'studio_user_account_secrets';
const KEY_VERSION = 'v1';
const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

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

const getEncryptionKey = (): Buffer => {
  const rawKey = String(process.env.ACCOUNT_SECRETS_ENCRYPTION_KEY || '').trim();

  if (!rawKey) {
    throw new Error(
      'Missing ACCOUNT_SECRETS_ENCRYPTION_KEY. Please set a strong server-side encryption key before using /api/account-secrets.',
    );
  }

  return createHash('sha256').update(rawKey, 'utf8').digest();
};

const encryptSnapshot = (
  snapshot: StudioAccountSecretsSnapshot,
): AccountSecretsCipherEnvelope => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    keyVersion: KEY_VERSION,
    algorithm: CIPHER_ALGORITHM,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  };
};

const decryptSnapshot = (
  envelope: AccountSecretsCipherEnvelope | null | undefined,
): StudioAccountSecretsSnapshot => {
  if (!envelope) {
    return createEmptyAccountSecretsSnapshot();
  }

  if (
    envelope.version !== 1
    || envelope.algorithm !== CIPHER_ALGORITHM
    || !envelope.iv
    || !envelope.ciphertext
    || !envelope.authTag
  ) {
    throw new Error('Invalid encrypted account secrets payload.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(envelope.iv, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('Encrypted account secrets payload is not valid JSON.');
  }

  return normalizeAccountSecretsSnapshot(parsed);
};

const readRemoteSnapshot = async (
  supabase: any,
  userId: string,
): Promise<StudioAccountSecretsSnapshot> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('encrypted_payload')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data || null) as AccountSecretsRow | null;
  if (!row?.encrypted_payload) {
    return createEmptyAccountSecretsSnapshot(0);
  }

  return decryptSnapshot(row.encrypted_payload);
};

const writeRemoteSnapshot = async (
  supabase: any,
  userId: string,
  snapshot: StudioAccountSecretsSnapshot,
  baseUpdatedAt?: number,
): Promise<StudioAccountSecretsSnapshot> => {
  const { data: existingData, error: existingError } = await supabase
    .from(TABLE_NAME)
    .select('encrypted_payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existingRow = (existingData || null) as AccountSecretsRow | null;
  const existingSnapshot = existingRow?.encrypted_payload
    ? decryptSnapshot(existingRow.encrypted_payload)
    : createEmptyAccountSecretsSnapshot(0);
  const normalizedBaseUpdatedAt = Number(baseUpdatedAt || 0);

  if (
    Number.isFinite(normalizedBaseUpdatedAt)
    && normalizedBaseUpdatedAt > 0
    && existingSnapshot.updatedAt > normalizedBaseUpdatedAt
  ) {
    const conflictError = new Error('account_secrets_conflict') as Error & {
      code?: string;
      conflictSnapshot?: StudioAccountSecretsSnapshot;
    };
    conflictError.code = 'ACCOUNT_SECRETS_CONFLICT';
    conflictError.conflictSnapshot = existingSnapshot;
    throw conflictError;
  }

  const payload: AccountSecretsRow = {
    user_id: userId,
    encrypted_payload: encryptSnapshot(snapshot),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert([payload], {
      onConflict: 'user_id',
    })
    .select('encrypted_payload')
    .single();

  if (error) {
    throw error;
  }

  const row = (data || null) as AccountSecretsRow | null;
  return decryptSnapshot(row?.encrypted_payload || payload.encrypted_payload);
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
      const snapshot = await readRemoteSnapshot(supabase, user.id);
      return res.status(200).json({ snapshot });
    }

    const body = readBody(req);
    const snapshot = normalizeAccountSecretsSnapshot(body?.snapshot);
    const baseUpdatedAt = Number(body?.baseUpdatedAt || 0);
    const storedSnapshot = await writeRemoteSnapshot(
      supabase,
      user.id,
      snapshot,
      Number.isFinite(baseUpdatedAt) && baseUpdatedAt > 0 ? baseUpdatedAt : undefined,
    );
    return res.status(200).json({ snapshot: storedSnapshot });
  } catch (error: any) {
    if (error?.code === 'ACCOUNT_SECRETS_CONFLICT') {
      return res.status(409).json({
        error: '账号上的敏感配置已在其他设备更新，请先恢复最新配置后再保存。',
        snapshot: error?.conflictSnapshot || createEmptyAccountSecretsSnapshot(0),
      });
    }
    console.error('[account-secrets] request failed', error);
    return res.status(500).json({ error: error?.message || 'account_secrets_failed' });
  }
}
