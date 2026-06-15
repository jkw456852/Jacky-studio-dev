const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const strengthToRepeats = (strength: number): number => {
  if (strength >= 0.85) return 3
  if (strength >= 0.65) return 2
  return 1
}

const normalizePromptForReferenceRoleParsing = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const REF1_ALIASES = [
  '参考图一', '参考图1', '图一', '图1', '第一张', '第1张', '第一幅', '第1幅',
  'ref1', 'ref 1', 'reference1', 'reference 1', 'image1', 'image 1',
]

const REF2_ALIASES = [
  '参考图二', '参考图2', '图二', '图2', '第二张', '第2张', '第二幅', '第2幅',
  'ref2', 'ref 2', 'reference2', 'reference 2', 'image2', 'image 2',
]

const LAYOUT_ROLE_CUES = [
  '海报', '构图', '版式', '排版', '布局', '画面', '风格', '样式', '氛围', 'style', 'layout', 'composition', 'poster',
]

const PRODUCT_ROLE_CUES = [
  '产品', '商品', '主体', '包装', '瓶子', '瓶身', '品牌', 'logo', '标志', '主物', 'product', 'brand', 'packaging',
]

const findOccurrences = (text: string, needles: string[]): number[] => {
  const hits: number[] = []
  for (const needle of needles) {
    let startIndex = 0
    while (startIndex < text.length) {
      const hitIndex = text.indexOf(needle, startIndex)
      if (hitIndex === -1) break
      hits.push(hitIndex)
      startIndex = hitIndex + needle.length
    }
  }
  return hits
}

const hasAliasCueProximity = (
  text: string,
  aliases: string[],
  cues: string[],
  maxDistance = 28,
): boolean => {
  const aliasHits = findOccurrences(text, aliases)
  const cueHits = findOccurrences(text, cues)
  if (aliasHits.length === 0 || cueHits.length === 0) {
    return false
  }
  for (const aliasHit of aliasHits) {
    for (const cueHit of cueHits) {
      if (Math.abs(aliasHit - cueHit) <= maxDistance) {
        return true
      }
    }
  }
  return false
}

const hasAnyAlias = (text: string, aliases: string[]): boolean =>
  aliases.some((alias) => text.includes(alias))

const inferExplicitReferenceRoleAssignment = (
  userPrompt: string,
  referenceCount: number,
): {
  layoutReferenceIndex: 1 | 2
  productReferenceIndex: 1 | 2
} | null => {
  if (referenceCount < 2) {
    return null
  }

  const prompt = normalizePromptForReferenceRoleParsing(userPrompt)
  if (!prompt) {
    return null
  }

  const ref1Mentioned = hasAnyAlias(prompt, REF1_ALIASES)
  const ref2Mentioned = hasAnyAlias(prompt, REF2_ALIASES)
  if (!ref1Mentioned || !ref2Mentioned) {
    return null
  }

  const ref1Layout = hasAliasCueProximity(prompt, REF1_ALIASES, LAYOUT_ROLE_CUES)
  const ref1Product = hasAliasCueProximity(prompt, REF1_ALIASES, PRODUCT_ROLE_CUES)
  const ref2Layout = hasAliasCueProximity(prompt, REF2_ALIASES, LAYOUT_ROLE_CUES)
  const ref2Product = hasAliasCueProximity(prompt, REF2_ALIASES, PRODUCT_ROLE_CUES)

  const explicitPattern12 =
    /(?:参考图[一1]|图[一1]|第[一1]张).{0,24}(?:海报|构图|版式|布局|风格|样式|画面|poster|layout|composition|style)/i.test(prompt) ||
    /(?:用|把|换成|替换成).{0,12}(?:参考图[二2]|图[二2]|第[二2]张|ref ?2|reference ?2).{0,12}(?:产品|商品|主体|包装|品牌|logo|product|brand|packaging)/i.test(prompt)

  const explicitPattern21 =
    /(?:参考图[二2]|图[二2]|第[二2]张).{0,24}(?:海报|构图|版式|布局|风格|样式|画面|poster|layout|composition|style)/i.test(prompt) ||
    /(?:用|把|换成|替换成).{0,12}(?:参考图[一1]|图[一1]|第[一1]张|ref ?1|reference ?1).{0,12}(?:产品|商品|主体|包装|品牌|logo|product|brand|packaging)/i.test(prompt)

  if ((ref1Layout && ref2Product) || (explicitPattern12 && !ref2Layout)) {
    return {
      layoutReferenceIndex: 1,
      productReferenceIndex: 2,
    }
  }

  if ((ref2Layout && ref1Product) || (explicitPattern21 && !ref1Layout)) {
    return {
      layoutReferenceIndex: 2,
      productReferenceIndex: 1,
    }
  }

  return null
}

export const buildConstrainedPrompt = (
  userPrompt: string,
  opts: {
    strength: number
    mode: 'style' | 'product'
    referenceRoleMode?: 'none' | 'default' | 'poster-product' | 'custom'
    referenceCount?: number
    priority?: 'first' | 'all'
    forbiddenChanges?: string[]
    approvedSummary?: string
  },
): string => {
  const hard = opts.strength >= 0.7
  const referenceCount = Math.max(0, opts.referenceCount || 0)
  const multiReference = referenceCount > 1
  const isPosterProductMode =
    opts.referenceRoleMode === 'poster-product' && referenceCount >= 2

  if (isPosterProductMode) {
    const approvedContext = opts.approvedSummary
      ? `
[Approved Anchor]
- Continue from the latest approved result as the current design baseline.
- Approved summary: ${opts.approvedSummary}
`
      : ''

    const forbiddenSection = opts.forbiddenChanges && opts.forbiddenChanges.length > 0
      ? `
[Forbidden Changes]
${opts.forbiddenChanges.map((item) => `- ${item}`).join('\n')}
`
      : ''

    return `
[Poster Reconstruction Mode]
- Reference image 1 is the poster/layout anchor.
- Reference image 2 is the product identity anchor.
- Rebuild the overall poster composition, framing, camera angle, background style, lighting direction, text-safe empty space, and design language from reference image 1 as closely as possible.
- Replace only the main product/hero subject in reference image 1 with the product from reference image 2.
- Keep the product from reference image 2 exact in silhouette, structure, proportions, color family, materials, logos, placement, and distinctive details.
- Do not create a brand-new composition.
- Do not merge both references into a different scene.
- If there is any conflict, preserve poster layout/style from reference image 1 and preserve product identity/details from reference image 2.
- Any additional references beyond the first two are supporting detail only and must not override those role assignments.
${approvedContext}${forbiddenSection}
[Do Not]
- Do not redesign the poster structure.
- Do not replace the composition with a generic ad layout.
- Do not change the product type, shape, or key details.
- Do not drift away from the visual hierarchy of reference image 1.

[User Request]
${userPrompt}`.trim()
  }

  const constraints = opts.mode === 'product'
    ? `
[Consistency Requirements]
- Keep product silhouette, cut, structure, color family, material texture, and major details consistent with references.
- Do not add/remove logos, stitching lines, trims, or hardware when they are visible.
- Preserve relative logo placement and key detailing when visible in references.
- Allowed changes: background, ambience, props, and composition only.
`
    : `
[Style Requirements]
- Keep visual style, color language, and composition tendency aligned with references.
- Preserve the overall mood and design direction across outputs.
`

  const referenceInstructions = multiReference
    ? `
[Multi-Reference Policy]
- Treat all reference images as the same subject shown from different angles or with complementary details.
- Synthesize identity using ALL references together instead of copying only the first image.
- If references conflict, prioritize silhouette, logo placement, signature details, material texture, and core color family.
- Merge the strongest consistent traits across all references into one coherent final subject.
`
    : opts.priority === 'first'
      ? `
[Reference Priority]
- The first reference is the primary identity anchor.
- Secondary references may add detail, but must not override the main subject identity.
`
      : ''

  const negatives = hard
    ? `
[Do Not]
- Do not change product type or core shape.
- Do not drift to a different SKU-like design.
- Do not over-stylize and lose material realism.
`
    : ''

  const approvedContext = opts.approvedSummary
    ? `
[Approved Anchor]
- Continue from the latest approved result as the current design baseline.
- Approved summary: ${opts.approvedSummary}
`
    : ''

  const forbiddenSection = opts.forbiddenChanges && opts.forbiddenChanges.length > 0
    ? `
[Forbidden Changes]
${opts.forbiddenChanges.map((item) => `- ${item}`).join('\n')}
`
    : ''

  return `${constraints}${referenceInstructions}${approvedContext}${forbiddenSection}${negatives}
[User Request]
${userPrompt}`.trim()
}

export const buildReferenceGroundingPrompt = (
  userPrompt: string,
  opts: {
    referenceCount?: number
  },
): string => {
  const referenceCount = Math.max(0, opts.referenceCount || 0)
  const inferredReferenceRoles = inferExplicitReferenceRoleAssignment(
    userPrompt,
    referenceCount,
  )
  const multiReferenceSection = referenceCount >= 2
    ? `
[Multiple Reference Handling]
- Read all reference images together instead of randomly following only one image.
- If the user assigns different roles to different references, follow that assignment exactly.
- Do not swap reference roles or ignore the product identity reference.
`
    : ''
  const explicitRoleSection = inferredReferenceRoles
    ? `
[Explicit Reference Role Assignment]
- The user explicitly assigned different roles to the references.
- Reference image ${inferredReferenceRoles.layoutReferenceIndex} is the layout/style/composition anchor.
- Reference image ${inferredReferenceRoles.productReferenceIndex} is the product identity and branding anchor.
- Keep the overall poster/layout direction from reference image ${inferredReferenceRoles.layoutReferenceIndex}, while preserving the product shape, packaging, brand spelling, logo placement, and key details from reference image ${inferredReferenceRoles.productReferenceIndex}.
- Do not replace the assigned product brand with unrelated new branding.
`
    : ''

  return `
[Reference Grounding]
- Do not apply any hidden style-library preset or extra composition template beyond the user's own request.
- Follow the user's written instruction as the only creative directive.
- Keep the main product identity faithful to the relevant reference image(s).
- Preserve visible brand name, logo spelling, packaging layout, silhouette, proportions, materials, colors, and signature details unless the user explicitly asks to change them.
- Do not invent a new brand, replace the visible logo with another brand, or redesign the product into a different SKU-like object.
- If exact brand text cannot be rendered perfectly, prefer keeping the original packaging structure and brand placement rather than replacing it with unrelated new branding.
${multiReferenceSection}${explicitRoleSection}
[User Request]
${userPrompt}`.trim()
}

export const buildTextPolicySuffix = (
  textPolicy?: {
    enforceChinese?: boolean
    requiredCopy?: string
  },
): string => {
  if (!textPolicy?.enforceChinese && !textPolicy?.requiredCopy) {
    return ''
  }

  const rules: string[] = []
  if (textPolicy.enforceChinese) {
    rules.push('[Text Rendering Rules]')
    rules.push('- Any visible text in the generated image must be rendered in Chinese only.')
    rules.push('- Do not render English letters, Japanese kana, Korean characters, or mixed-language branding unless the user explicitly requested them.')
  }

  const requiredCopy = String(textPolicy.requiredCopy || '').trim()
  if (requiredCopy) {
    if (rules.length === 0) {
      rules.push('[Text Rendering Rules]')
    }
    rules.push(`- The visible text must exactly match this copy: "${requiredCopy}". Do not add, remove, paraphrase, or translate any character.`)
  }

  return rules.join('\n').trim()
}

export const buildReferenceInjectionPlan = (args: {
  references: string[]
  referenceStrength?: number
  referenceMode?: 'style' | 'product'
  referencePriority?: 'first' | 'all'
}): {
  strength: number
  mode: 'style' | 'product'
  priority: 'first' | 'all'
  repeats: number
  referencesToInject: string[]
} => {
  const hasReferences = args.references.length > 0
  const strength = clamp01(Number.isFinite(args.referenceStrength as number) ? Number(args.referenceStrength) : 0.75)
  const mode = args.referenceMode || 'product'
  const priority = args.referencePriority || (args.references.length > 1 ? 'all' : 'first')
  const repeats = hasReferences && priority === 'first' ? strengthToRepeats(strength) : 1

  const referencesToInject: string[] = []
  if (args.references[0] && priority === 'first') {
    for (let i = 0; i < repeats; i += 1) {
      referencesToInject.push(args.references[0])
    }
    referencesToInject.push(...args.references.slice(1))
  } else {
    referencesToInject.push(...args.references)
  }

  return {
    strength,
    mode,
    priority,
    repeats,
    referencesToInject,
  }
}

export const buildBaseImagePrompt = (args: {
  prompt: string
  hasReferences: boolean
  referenceCount: number
  referenceStrength: number
  referenceMode: 'style' | 'product'
  referencePriority: 'first' | 'all'
  referenceRoleMode?: 'none' | 'default' | 'poster-product' | 'custom'
  forbiddenChanges?: string[]
  approvedSummary?: string
}): string => {
  const shouldDisableHiddenConstraints = args.referenceRoleMode === 'none'
  if (shouldDisableHiddenConstraints) {
    return args.hasReferences
      ? buildReferenceGroundingPrompt(args.prompt, { referenceCount: args.referenceCount })
      : args.prompt
  }

  if (args.hasReferences || args.forbiddenChanges?.length || args.approvedSummary) {
    return buildConstrainedPrompt(args.prompt, {
      strength: args.referenceStrength,
      mode: args.referenceMode,
      referenceRoleMode: args.referenceRoleMode,
      referenceCount: args.referenceCount,
      priority: args.referencePriority,
      forbiddenChanges: args.forbiddenChanges,
      approvedSummary: args.approvedSummary,
    })
  }

  return args.prompt
}
