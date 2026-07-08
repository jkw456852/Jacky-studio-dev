const normalizeText = (value: string | null | undefined): string =>
  String(value || '').trim();

export const extractAspectRatioHint = (
  message: string | null | undefined,
): string | undefined => {
  const normalized = normalizeText(message);
  if (!normalized) return undefined;

  const match = normalized.match(
    /(?:^|[^\d])((?:21|16|9|5|4|3|2|1)\s*[:：xX／/]\s*(?:21|16|9|8|5|4|3|2|1))(?:[^\d]|$)/,
  );
  if (!match) return undefined;

  const compact = match[1].replace(/\s+/g, '').replace(/[：xX／/]/g, ':');
  const [widthText, heightText] = compact.split(':');
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return `${width}:${height}`;
};

export const extractImageSizeHint = (
  message: string | null | undefined,
): '1K' | '2K' | '4K' | undefined => {
  const normalized = normalizeText(message);
  if (!normalized) return undefined;

  if (/(?:^|[^\d])(4k|4096|3840)(?:[^\d]|$)/i.test(normalized)) return '4K';
  if (/(?:^|[^\d])(2k|2048)(?:[^\d]|$)/i.test(normalized)) return '2K';
  if (/(?:^|[^\d])(1k|1024)(?:[^\d]|$)/i.test(normalized)) return '1K';
  return undefined;
};

export const extractExactSizeHint = (
  message: string | null | undefined,
): string | undefined => {
  const normalized = normalizeText(message);
  if (!normalized) return undefined;

  const match = normalized.match(
    /(?:^|[^\d])((?:1024|1280|1440|1536|1792|2048|2160|2304|2560|3072|3840|4096)\s*[xX×]\s*(?:1024|1280|1440|1536|1792|2048|2160|2304|2560|3072|3840|4096))(?:[^\d]|$)/,
  );
  if (!match) return undefined;
  return match[1].replace(/\s+/g, '').replace(/[×X]/g, 'x');
};

