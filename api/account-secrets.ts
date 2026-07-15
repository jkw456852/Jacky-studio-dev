import { createClient } from '@supabase/supabase-js';
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import {
  createEmptyAccountSecretsSnapshot,
  normalizeAccountSecretsSnapshot,
  type StudioAccountSecretsSnapshot,
} from '../services/account-secrets-shared.ts';

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

type AccountSecretsApiError = Error & {
  status: number;
  code: string;
  details?: Record<string, unknown>;
};

const createAccountSecretsApiError = (
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): AccountSecretsApiError => {
  const error = new Error(message) as AccountSecretsApiError;
  error.name = 'AccountSecretsApiError';
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const readErrorRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

const readErrorText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  const record = readErrorRecord(value);
  if (typeof record.message === 'string') return record.message.trim();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value || '').trim();
  }
};

const isMissingAccountSecretsTableError = (error: unknown): boolean => {
  const record = readErrorRecord(error);
  const code = String(record.code || '').trim().toUpperCase();
  const message = readErrorText(error).toLowerCase();
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

const isInvalidSupabaseServerKeyError = (error: unknown): boolean => {
  const record = readErrorRecord(error);
  const code = String(record.code || '').trim().toLowerCase();
  const message = readErrorText(error).toLowerCase();
  return (
    code === 'invalid_api_key'
    || message.includes('invalid api key')
    || message.includes('no api key found')
  );
};

export const classifyAccountSecretsServerError = (
  error: unknown,
): AccountSecretsApiError => {
  if (
    error
    && typeof error === 'object'
    && typeof (error as Partial<AccountSecretsApiError>).status === 'number'
    && typeof (error as Partial<AccountSecretsApiError>).code === 'string'
  ) {
    return error as AccountSecretsApiError;
  }

  if (isMissingAccountSecretsTableError(error)) {
    return createAccountSecretsApiError(
      503,
      'account_secrets_table_missing',
      '账户敏感配置存储尚未初始化，请先执行 Supabase migration。',
      {
        table: TABLE_NAME,
        migration: 'supabase/migrations/202607150001_create_studio_user_account_secrets.sql',
      },
    );
  }

  if (isInvalidSupabaseServerKeyError(error)) {
    return createAccountSecretsApiError(
      503,
      'account_secrets_service_key_invalid',
      'Supabase 服务端密钥无效或不属于当前项目，请更新 Vercel 的 SUPABASE_SERVICE_ROLE_KEY。',
    );
  }

  const record = readErrorRecord(error);
  const providerCode = String(record.code || '').trim();
  if (providerCode) {
    return createAccountSecretsApiError(
      502,
      'account_secrets_database_failed',
      'Supabase 敏感配置存储请求失败。',
      {
        providerCode,
        providerMessage: readErrorText(error),
        ...(typeof record.hint === 'string' && record.hint.trim()
          ? { providerHint: record.hint.trim() }
          : {}),
      },
    );
  }

  const message = readErrorText(error);
  if (
    message.includes('Invalid encrypted account secrets payload')
    || message.includes('Encrypted account secrets payload is not valid JSON')
    || message.toLowerCase().includes('unable to authenticate data')
  ) {
    return createAccountSecretsApiError(
      500,
      'account_secrets_decryption_failed',
      '账户敏感配置无法解密，请确认生产环境中的加密密钥未被更换。',
    );
  }

  return createAccountSecretsApiError(
    500,
    'account_secrets_failed',
    message || '账户敏感配置同步失败。',
  );
};

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
    throw createAccountSecretsApiError(
      503,
      'account_secrets_server_env_missing',
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

const getEncryptionKey = (): Buffer => {
  const rawKey = String(process.env.ACCOUNT_SECRETS_ENCRYPTION_KEY || '').trim();

  if (!rawKey) {
    throw createAccountSecretsApiError(
      503,
      'account_secrets_encryption_key_missing',
      'Vercel 缺少 ACCOUNT_SECRETS_ENCRYPTION_KEY，无法安全同步敏感配置。',
      { missingEnv: ['ACCOUNT_SECRETS_ENCRYPTION_KEY'] },
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
    throw classifyAccountSecretsServerError(error);
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
    throw classifyAccountSecretsServerError(existingError);
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
    throw classifyAccountSecretsServerError(error);
  }

  const row = (data || null) as AccountSecretsRow | null;
  return decryptSnapshot(row?.encrypted_payload || payload.encrypted_payload);
};

export default async function handler(req: any, res: any) {
  const requestId = randomUUID().slice(0, 8);
  res.setHeader?.('x-account-secrets-request-id', requestId);

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
      throw classifyAccountSecretsServerError(authError);
    }

    if (authError || !user) {
      return res.status(401).json({
        error: authError?.message || 'Invalid auth token',
        code: 'invalid_auth_token',
        requestId,
      });
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
        code: 'account_secrets_conflict',
        requestId,
        snapshot: error?.conflictSnapshot || createEmptyAccountSecretsSnapshot(0),
      });
    }
    const apiError = classifyAccountSecretsServerError(error);
    console.error('[account-secrets] request failed', {
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
