import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyAccountSecretsServerError } from '../api/account-secrets.ts';
import {
  getAccountSecretsResponseErrorMessage,
  readSnapshotResponse,
} from './account-secrets-response.ts';

test('account secrets server classifies a missing Supabase table', () => {
  const error = classifyAccountSecretsServerError({
    code: 'PGRST205',
    message:
      "Could not find the table 'public.studio_user_account_secrets' in the schema cache",
    details: '',
    hint: '',
  });

  assert.equal(error.status, 503);
  assert.equal(error.code, 'account_secrets_table_missing');
  assert.match(error.message, /Supabase migration/);
  assert.equal(
    error.details?.migration,
    'supabase/migrations/202607150001_create_studio_user_account_secrets.sql',
  );
});

test('account secrets server classifies an invalid Supabase server key', () => {
  const error = classifyAccountSecretsServerError({
    code: 'invalid_api_key',
    message: 'Invalid API key',
  });

  assert.equal(error.status, 503);
  assert.equal(error.code, 'account_secrets_service_key_invalid');
  assert.match(error.message, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('account secrets client extracts nested API errors without object coercion', () => {
  assert.equal(
    getAccountSecretsResponseErrorMessage(
      {
        error: {
          code: 'account_secrets_table_missing',
          message: '账户敏感配置存储尚未初始化。',
        },
      },
      'fallback',
    ),
    '账户敏感配置存储尚未初始化。',
  );
});

test('account secrets response preserves diagnostic code and request id', async () => {
  const response = new Response(
    JSON.stringify({
      error: {
        message: 'Vercel 缺少服务端环境变量。',
      },
      code: 'account_secrets_server_env_missing',
      requestId: 'req-1234',
    }),
    {
      status: 503,
      headers: {
        'content-type': 'application/json',
      },
    },
  );

  await assert.rejects(
    readSnapshotResponse(response, 'Sensitive config restore'),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Vercel 缺少服务端环境变量。');
      assert.equal(
        (error as Error & { code?: string }).code,
        'account_secrets_server_env_missing',
      );
      assert.equal(
        (error as Error & { requestId?: string }).requestId,
        'req-1234',
      );
      return true;
    },
  );
});
