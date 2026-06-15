import {
  getOfficialGptImage2Size,
  getNormalizedAspectRatioForImageModel,
  isGptImage2FamilyModel,
  normalizeWorkspaceImageSize,
  parseImageSizeString,
} from '../../openai-image-presets.ts'

export const isOpenAICompatibleImageModel = (model: string): boolean => {
  const normalized = String(model || '').trim().toLowerCase()
  return normalized === 'gpt-image-2'
    || normalized === 'gpt image 2'
    || normalized === 'gpt-image-1.5-all'
    || normalized === 'gpt image 1.5'
    || normalized.startsWith('gpt-image-')
    || normalized.includes('gpt-image-2')
    || normalized.includes('gpt image 2')
    || normalized.includes('gpt-image-1.5')
    || normalized.includes('gpt image 1.5')
}

export const normalizeOpenAICompatibleImageModelId = (model: string): string => {
  const normalized = String(model || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('gpt-image-2') || normalized.includes('gpt image 2')) {
    return 'gpt-image-2'
  }
  if (
    normalized.includes('gpt-image-1.5-all')
    || normalized.includes('gpt image 1.5')
    || normalized.includes('gpt-image-1.5')
  ) {
    return 'gpt-image-1.5-all'
  }
  return String(model || '').trim()
}

export type OpenAIImageRequestMode = 'standard-openai' | 'reverse-compat' | 'official-transfer'

export const getOpenAIImageRequestMode = (
  model: string,
  imageSize?: '1K' | '2K' | '4K',
  exactSize?: string,
): OpenAIImageRequestMode => {
  const normalizedModel = normalizeOpenAICompatibleImageModelId(model)
  if (normalizedModel === 'gpt-image-2' || normalizedModel === 'gpt-image-2-all') {
    return 'official-transfer'
  }
  return 'standard-openai'
}

export const normalizeOpenAIImageAspectRatio = (
  model: string,
  aspectRatio: string,
): string => {
  const normalized = String(aspectRatio || '').trim()
  if (getOfficialGptImage2Size(normalized, '1K')) {
    return normalized
  }
  if (isGptImage2FamilyModel(model)) {
    return getNormalizedAspectRatioForImageModel(model, normalized)
  }
  if (normalized === '21:9' || normalized === '8:1' || normalized === '4:1') {
    return '16:9'
  }
  if (normalized === '1:4' || normalized === '1:8') {
    return '9:16'
  }
  return '1:1'
}

export const resolveOpenAIImageSize = (
  model: string,
  aspectRatio: string,
  imageSize?: '1K' | '2K' | '4K',
  exactSize?: string,
): string => {
  const normalizedExactSize = String(exactSize || '').trim()
  if (normalizedExactSize) {
    if (normalizedExactSize.toLowerCase() === 'auto') {
      return 'auto'
    }

    const parsedExactSize = parseImageSizeString(normalizedExactSize)
    if (parsedExactSize) {
      const normalized = normalizeWorkspaceImageSize(parsedExactSize)
      return `${normalized.width}x${normalized.height}`
    }
  }

  const ratio = normalizeOpenAIImageAspectRatio(model, aspectRatio)
  const preset = imageSize || '1K'
  const requestMode = getOpenAIImageRequestMode(model, preset, exactSize)

  const resolvedPreset = requestMode === 'reverse-compat' ? '1K' : preset
  return (
    getOfficialGptImage2Size(ratio, resolvedPreset)
    || getOfficialGptImage2Size('1:1', resolvedPreset)
    || '1024x1024'
  )
}

const mimeTypeToFileExtension = (mimeType: string): string => {
  const normalized = String(mimeType || '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('webp')) return 'webp'
  return 'bin'
}

export const dataUrlToFilePayload = (
  dataUrl: string,
  fallbackName: string,
): { blob: Blob; filename: string } | null => {
  const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/)
  if (!match) return null

  const mimeType = match[1]
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return {
    blob: new Blob([bytes], { type: mimeType }),
    filename: `${fallbackName}.${mimeTypeToFileExtension(mimeType)}`,
  }
}

export const estimateDataUrlBytes = (dataUrl: string): number => {
  const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/)
  if (!match) return 0
  const base64 = match[2]
  const padding = base64.match(/=*$/)?.[0]?.length || 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

const IMAGE_MODEL_ALIAS_MAP: Record<string, string> = {
  auto: 'Auto',
  'nano banana pro': 'gemini-3-pro-image-preview',
  'nanobanana pro': 'gemini-3-pro-image-preview',
  'nanobananapro': 'gemini-3-pro-image-preview',
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',

  nanobanana2: 'gemini-3.1-flash-image-preview',
  'nano banana 2': 'gemini-3.1-flash-image-preview',
  'nanobanana 2': 'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview',

  'seedream5.0': 'doubao-seedream-5-0-260128',
  'seedream 5.0': 'doubao-seedream-5-0-260128',
  'seedream 4': 'doubao-seedream-5-0-260128',
  'doubao-seedream-5-0-260128': 'doubao-seedream-5-0-260128',

  'gpt image 2': 'gpt-image-2',
  'gpt-image-2': 'gpt-image-2',
  'gptimage2': 'gpt-image-2',
  'image2': 'gpt-image-2',
  'image 2': 'gpt-image-2',
  'gpt image2': 'gpt-image-2',

  'gpt-image-2-all': 'gpt-image-2-all',
  'gpt image 2 all': 'gpt-image-2-all',

  'gpt image 1.5': 'gpt-image-1.5-all',
  'gpt-image-1.5-all': 'gpt-image-1.5-all',

  'flux.2 max': 'flux-pro-max',
  'flux-pro-max': 'flux-pro-max',
}

export const resolveCanonicalImageModelId = (model: string): string => {
  const normalized = String(model || '').trim()
  if (!normalized) return 'Auto'
  const lower = normalized.toLowerCase()

  const hit = IMAGE_MODEL_ALIAS_MAP[lower]
  if (hit) return hit

  if (lower.includes('gemini-1.5-pro-image-preview-tok')) return 'gemini-3-pro-image-preview'
  if (lower.includes('1.5-pro-image-preview') || lower.includes('1.5-flash-image-preview')) return 'gemini-3-pro-image-preview'

  return normalized
}

const CANONICAL_TO_DISPLAY: Record<string, string> = {
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'gemini-3.1-flash-image-preview': 'NanoBanana2',
  'doubao-seedream-5-0-260128': 'Seedream5.0',
  'gpt-image-2': 'gpt-image-2',
  'gpt-image-2-all': 'gpt-image-2-all',
  'gpt-image-1.5-all': 'gpt-image-1.5-all',
  'flux-pro-max': 'flux-pro-max',
}

export const resolveCanonicalImageModelDisplayName = (model: string): string => {
  const canonical = resolveCanonicalImageModelId(model)
  if (canonical === 'Auto') return 'NanoBanana2'
  return CANONICAL_TO_DISPLAY[canonical] || model
}
