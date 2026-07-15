import {
  normalizeAccountSecretsSnapshot,
  type StudioAccountSecretsSnapshot,
} from './account-secrets-shared.ts';

type AccountSecretsErrorResponse = {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  details?: unknown;
  requestId?: unknown;
  snapshot?: StudioAccountSecretsSnapshot;
};

export type AccountSecretsRequestError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
};

const normalizeString = (value: unknown): string => String(value ?? '').trim();

const readAccountSecretsErrorText = (
  value: unknown,
  depth = 0,
): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (!value || typeof value !== 'object' || depth > 3) return '';

  const record = value as Record<string, unknown>;
  for (const key of ['message', 'error', 'details', 'hint', 'code']) {
    const text = readAccountSecretsErrorText(record[key], depth + 1);
    if (text) return text;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized === '{}' ? '' : serialized;
  } catch {
    return '';
  }
};

export const getAccountSecretsResponseErrorMessage = (
  payload: unknown,
  fallback: string,
): string => {
  const record = payload && typeof payload === 'object'
    ? payload as AccountSecretsErrorResponse
    : null;
  return (
    readAccountSecretsErrorText(record?.message)
    || readAccountSecretsErrorText(record?.error)
    || readAccountSecretsErrorText(record?.details)
    || readAccountSecretsErrorText(payload)
    || fallback
  );
};

export const readSnapshotResponse = async (
  response: Response,
  actionLabel: string,
): Promise<StudioAccountSecretsSnapshot> => {
  const responseText = await response.text().catch(() => '');
  let payload: AccountSecretsErrorResponse | null = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as AccountSecretsErrorResponse;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const fallback = `${actionLabel} failed: ${response.status} ${response.statusText}`;
    const rawFallback = responseText && !/^\s*</.test(responseText)
      ? responseText.slice(0, 1000)
      : fallback;
    const error = new Error(
      getAccountSecretsResponseErrorMessage(payload, rawFallback),
    ) as AccountSecretsRequestError & {
      conflictSnapshot?: StudioAccountSecretsSnapshot;
    };
    error.name = 'AccountSecretsRequestError';
    error.status = response.status;
    error.code = normalizeString(payload?.code) || undefined;
    error.details = payload?.details;
    error.requestId =
      normalizeString(payload?.requestId)
      || normalizeString(response.headers.get('x-account-secrets-request-id'))
      || undefined;
    if (response.status === 409 && payload?.snapshot) {
      error.name = 'AccountSecretsConflictError';
      error.conflictSnapshot = normalizeAccountSecretsSnapshot(payload.snapshot);
    }
    throw error;
  }

  return normalizeAccountSecretsSnapshot(payload?.snapshot);
};
