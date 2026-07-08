const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;

const normalizeBase64Payload = (value: string): string => {
  const sanitized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const paddingNeeded = sanitized.length % 4;
  if (paddingNeeded === 0) return sanitized;
  return sanitized.padEnd(sanitized.length + (4 - paddingNeeded), '=');
};

export const normalizeImageDataUrlString = (input: string): string | null => {
  const normalizedInput = String(input || '').trim();
  if (!normalizedInput) return null;
  const match = normalizedInput.match(DATA_URL_RE);
  if (!match) return null;
  const mimeType = String(match[1] || '').toLowerCase();
  const base64 = normalizeBase64Payload(match[2] || '');
  if (!base64) return null;
  try {
    atob(base64);
  } catch {
    return null;
  }
  return `data:${mimeType};base64,${base64}`;
};

export const isNormalizedImageDataUrl = (input: string): boolean =>
  Boolean(normalizeImageDataUrlString(input));
