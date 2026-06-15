export type OpenAIImageRouteDecision = {
  route: '/v1/images/generations' | '/v1/images/edits'
  effectiveRoute: string
  isEditRequest: boolean
  shouldUseJsonEditPayload: boolean
  imageFieldMode: 'json' | 'json-image-ref-array' | 'multi-file-repeated-field' | 'single-file'
}

export type OpenAIImageTransportProfileInput = {
  editPayloadModes?: Array<'json-image-ref-array' | 'multi-file-repeated-field' | 'single-file' | 'none'>
  jsonEditOfficialOnly?: boolean
}

export const isOfficialOpenAIBaseUrl = (normalizeUrl: (baseUrl: string) => string, baseUrl: string): boolean => {
  try {
    const host = new URL(normalizeUrl(baseUrl || '')).host.toLowerCase()
    return host === 'api.openai.com' || host.endsWith('.openai.com')
  } catch {
    return false
  }
}

export const decideOpenAIImageRoute = (args: {
  baseUrl: string
  model: string
  providerId?: string | null
  normalizedReferenceCount: number
  hasMask: boolean
  size: string
  requestMode: string
  resolveImageModelPostPath: (args: { providerId?: string | null; modelId: string; hasReferences: boolean }) => string
  isGptImage2FamilyModel: (model: string) => boolean
  normalizeUrl: (baseUrl: string) => string
  transportProfile?: OpenAIImageTransportProfileInput | null
}): OpenAIImageRouteDecision => {
  const isEditRequest = args.normalizedReferenceCount > 0 || args.hasMask
  const route = isEditRequest ? '/v1/images/edits' : '/v1/images/generations'
  const effectiveRoute = args.resolveImageModelPostPath({
    providerId: args.providerId || null,
    modelId: args.model,
    hasReferences: isEditRequest,
  })
  const allowsJsonEdit =
    !args.transportProfile?.editPayloadModes
    || args.transportProfile.editPayloadModes.includes('json-image-ref-array')
  const jsonEditOfficialOnly = args.transportProfile?.jsonEditOfficialOnly !== false
  const isOfficial = isOfficialOpenAIBaseUrl(args.normalizeUrl, args.baseUrl)
  const shouldUseJsonEditPayload =
    isEditRequest &&
    args.isGptImage2FamilyModel(args.model) &&
    isOfficialOpenAIBaseUrl(args.normalizeUrl, args.baseUrl) &&
    allowsJsonEdit &&
    args.normalizedReferenceCount > 0 &&
    (args.size === 'auto' || args.requestMode === 'official-transfer')
  const imageFieldMode = isEditRequest
    ? shouldUseJsonEditPayload
      ? 'json-image-ref-array'
      : args.normalizedReferenceCount > 1
        ? 'multi-file-repeated-field'
        : 'single-file'
    : 'json'

  return {
    route,
    effectiveRoute,
    isEditRequest,
    shouldUseJsonEditPayload,
    imageFieldMode,
  }
}
