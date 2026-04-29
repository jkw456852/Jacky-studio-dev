import { ProviderError } from '../utils/provider-error';
import { fetchWithResilience } from './http/api-client';
import { getProviderConfig } from './provider-config';
import { useImageHostStore } from '../stores/imageHost.store';

const isNetworkFetchError = (error: unknown): boolean => {
  const msg = ((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('cors') ||
    msg.includes('load failed') ||
    msg.includes('loadfailed') ||
    msg.includes('fetch_image_timeout') ||
    msg.includes('timeout')
  );
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const loadImageFromDataUrl = async (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('reference image decode failed'));
    image.src = dataUrl;
  });
};

const flattenTransparentReferenceToWhiteJpeg = async (
  dataUrl: string,
  quality = 0.95,
): Promise<string> => {
  if (typeof document === 'undefined') {
    return dataUrl;
  }

  const image = await loadImageFromDataUrl(dataUrl);
  const width = Math.max(1, image.naturalWidth || image.width || 1);
  const height = Math.max(1, image.naturalHeight || image.height || 1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return dataUrl;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
};

const inferSafeCanvasExportMimeType = (
  imageUrl: string,
  naturalWidth: number,
  naturalHeight: number,
): 'image/png' | 'image/jpeg' => {
  const normalized = String(imageUrl || '').toLowerCase();
  if (
    normalized.includes('.png') ||
    normalized.includes('image/png') ||
    normalized.includes('.webp') ||
    normalized.includes('image/webp')
  ) {
    return 'image/png';
  }

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return 'image/png';
  }

  return 'image/jpeg';
};

const fetchReferenceViaServer = async (imageUrl: string): Promise<string | null> => {
  console.log('[reference-resolver] Using CORS fallback strategies for:', imageUrl);
  
  // Strategy 1: Bypass fetch() OPTIONS preflight via Image + Canvas
  try {
    const canvasDataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Important for preventing tainted canvas
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No 2d context available');
          ctx.drawImage(img, 0, 0);
          const exportMimeType = inferSafeCanvasExportMimeType(
            imageUrl,
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
          );
          resolve(
            exportMimeType === 'image/png'
              ? canvas.toDataURL('image/png')
              : canvas.toDataURL('image/jpeg', 0.95),
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      // Add cache buster to force clean CORS response
      img.src = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}corsbuster=${Date.now()}`;
    });
    console.log('[reference-resolver] Canvas strategy success!');
    return canvasDataUrl;
  } catch (err) {
    console.warn('[reference-resolver] Canvas bypass strategy failed:', err);
  }

  // Strategy 2: Proxy APIs
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`
  ];

  for (const proxyUrl of proxies) {
    try {
      console.log('[reference-resolver] Trying Proxy:', proxyUrl);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const blob = await response.blob();
        return await blobToDataUrl(blob);
      }
    } catch (e) {
      console.warn('[reference-resolver] Proxy strategy failed for', proxyUrl, e);
    }
  }

  return null;
};

export const normalizeReferenceToDataUrl = async (input: string): Promise<string | null> => {
  if (!input || typeof input !== 'string') return null;
  if (/^data:image\/.+;base64,/.test(input)) return input;

  // Debug: make it obvious when we silently drop references.
  // Keep logs lightweight; do not print full data URLs.
  const logPrefix = '[reference-resolver]';
  const safePreview = (value: string) => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.startsWith('data:image/')) return `data:image/...(${v.length} chars)`;
    return v.length > 160 ? `${v.slice(0, 160)}...` : v;
  };

  const selectedProvider = useImageHostStore.getState().selectedProvider;
  const preferHostedUrls = selectedProvider !== 'none';

  if (/^blob:/i.test(input)) {
    try {
      console.log(`${logPrefix} resolving blob reference:`, safePreview(input));
      const res = await fetchWithResilience(
        input,
        {},
        { operation: 'generateImage.resolveBlobReference', retries: 0, timeoutMs: 20000 },
      );
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return null;
      return await blobToDataUrl(blob);
    } catch {
      console.warn(`${logPrefix} blob reference failed, dropping:`, safePreview(input));
      return null;
    }
  }

  if (/^https?:\/\//i.test(input)) {
    console.log(`${logPrefix} resolving url reference:`, safePreview(input));
    if (preferHostedUrls && /(^https?:\/\/i\.ibb\.co\/)|(^https?:\/\/ibb\.co\/)/i.test(input)) {
      const serverDataUrl = await fetchReferenceViaServer(input);
      if (serverDataUrl) {
        return serverDataUrl;
      }
    }

    try {
      const res = await fetchWithResilience(
        input,
        {},
        { operation: 'generateImage.resolveReferenceUrl', retries: 1, timeoutMs: 30000 },
      );
      if (!res.ok) {
        console.warn(`${logPrefix} url fetch not ok (${res.status}), will try fallback:`, safePreview(input));
        if ([401, 403, 404, 408, 429, 500, 502, 503, 504].includes(res.status)) {
          const serverDataUrl = await fetchReferenceViaServer(input);
          if (serverDataUrl) return serverDataUrl;
        }
        return null;
      }

      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return null;
      return await blobToDataUrl(blob);
    } catch (error) {
      if (!isNetworkFetchError(error)) {
        return null;
      }

      const serverDataUrl = await fetchReferenceViaServer(input);
      if (serverDataUrl) {
        return serverDataUrl;
      }

      console.warn(`${logPrefix} All attempts failed, continuing without reference:`, safePreview(input));
      return null;
    }
  }

  return null;
};

export const normalizeReferenceToModelInputDataUrl = async (
  input: string,
): Promise<string | null> => {
  const normalized = await normalizeReferenceToDataUrl(input);
  if (!normalized) return null;

  if (/^data:image\/png;base64,/i.test(normalized)) {
    try {
      return await flattenTransparentReferenceToWhiteJpeg(normalized);
    } catch (error) {
      console.warn('[reference-resolver] png flatten failed, keeping original reference:', error);
      return normalized;
    }
  }

  return normalized;
};
