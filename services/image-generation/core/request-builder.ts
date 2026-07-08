export const buildOpenAIImageEditJsonPayload = (opts: {
  model: string
  prompt: string
  size: string
  quality?: 'low' | 'medium' | 'high'
  referenceImages: string[]
  maskImage?: string | null
  background?: 'transparent' | 'opaque' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
}) => ({
  model: opts.model,
  prompt: opts.prompt,
  images: opts.referenceImages.map((imageUrl) => ({ image_url: imageUrl })),
  size: opts.size,
  ...(opts.quality ? { quality: opts.quality } : {}),
  ...(opts.background ? { background: opts.background } : {}),
  ...(opts.outputFormat ? { output_format: opts.outputFormat } : {}),
  ...(opts.maskImage ? { mask: { image_url: opts.maskImage } } : {}),
})

export const buildOpenAIImageGenerationBody = (opts: {
  model: string
  prompt: string
  size: string
  quality?: 'low' | 'medium' | 'high'
  normalizedAspectRatio?: string | null
  background?: 'transparent' | 'opaque' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number
  moderation?: 'low' | 'auto'
  n?: number
  partialImages?: number
  stream?: boolean
  style?: 'vivid' | 'natural'
  responseFormat?: 'url' | 'b64_json'
}) => ({
  model: opts.model,
  prompt: opts.prompt,
  size: opts.size,
  ...(opts.quality ? { quality: opts.quality } : {}),
  ...(opts.background ? { background: opts.background } : {}),
  ...(opts.outputFormat ? { output_format: opts.outputFormat } : {}),
  ...(typeof opts.outputCompression === 'number' ? { output_compression: opts.outputCompression } : {}),
  ...(opts.moderation ? { moderation: opts.moderation } : {}),
  ...(typeof opts.n === 'number' ? { n: opts.n } : {}),
  ...(typeof opts.partialImages === 'number' ? { partial_images: opts.partialImages } : {}),
  ...(typeof opts.stream === 'boolean' ? { stream: opts.stream } : {}),
  ...(opts.style ? { style: opts.style } : {}),
  ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
  ...(opts.normalizedAspectRatio ? { aspect_ratio: opts.normalizedAspectRatio } : {}),
})

export const buildOpenAIImageEditFormData = (opts: {
  model: string
  prompt: string
  size: string
  quality?: 'low' | 'medium' | 'high'
  referenceImages: string[]
  maskImage?: string | null
  background?: 'transparent' | 'opaque' | 'auto'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  outputCompression?: number
  n?: number
  dataUrlToFilePayload: (dataUrl: string, baseName: string) =>
    | { blob: Blob; filename: string }
    | null
}) => {
  const formData = new FormData()
  formData.append('model', opts.model)
  formData.append('prompt', opts.prompt)
  formData.append('size', opts.size)
  if (opts.quality) {
    formData.append('quality', opts.quality)
  }
  if (opts.background) {
    formData.append('background', opts.background)
  }
  const outputFormat = opts.outputFormat || 'png'
  formData.append('output_format', outputFormat)
  if (outputFormat !== 'png' && typeof opts.outputCompression === 'number') {
    formData.append('output_compression', String(opts.outputCompression))
  }
  formData.append('n', String(opts.n || 1))
  formData.append('response_format', 'b64_json')

  const imageFieldName = 'image[]'
  const referenceMimeTypes: string[] = []
  opts.referenceImages.forEach((dataUrl, index) => {
    const filePayload = opts.dataUrlToFilePayload(dataUrl, `image-${index + 1}`)
    if (filePayload) {
      formData.append(imageFieldName, filePayload.blob, filePayload.filename)
      referenceMimeTypes.push(filePayload.blob.type || 'application/octet-stream')
    }
  })

  let maskMimeType: string | null = null
  if (opts.maskImage) {
    const maskPayload = opts.dataUrlToFilePayload(opts.maskImage, 'mask')
    if (maskPayload) {
      formData.append('mask', maskPayload.blob, maskPayload.filename)
      maskMimeType = maskPayload.blob.type || 'application/octet-stream'
    }
  }

  return {
    formData,
    imageFieldName,
    referenceMimeTypes,
    maskMimeType,
  }
}
