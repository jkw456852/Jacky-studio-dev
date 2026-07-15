import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyAccountSyncServerError } from '../../api/account-sync.ts';

test('account sync classifies an invalid Supabase server key as configuration failure', () => {
  const error = classifyAccountSyncServerError({
    code: 'invalid_api_key',
    message: 'Invalid API key',
  });

  assert.equal(error.status, 503);
  assert.equal(error.code, 'account_sync_service_key_invalid');
  assert.match(error.message, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('account sync classifies a missing Supabase table', () => {
  const error = classifyAccountSyncServerError({
    code: '42P01',
    message: 'relation "studio_user_assets" does not exist',
  });

  assert.equal(error.status, 503);
  assert.equal(error.code, 'account_sync_table_missing');
  assert.equal(
    error.details?.migration,
    'supabase/migrations/202607150000_create_studio_user_assets.sql',
  );
});
