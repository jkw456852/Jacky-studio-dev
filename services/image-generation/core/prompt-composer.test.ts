import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBaseImagePrompt,
  buildConstrainedPrompt,
  buildReferenceGroundingPrompt,
  buildReferenceInjectionPlan,
  buildTextPolicySuffix,
} from './prompt-composer.ts'

test('buildBaseImagePrompt returns grounding-only prompt when referenceRoleMode is none', () => {
  const prompt = buildBaseImagePrompt({
    prompt: '把参考图二的产品放进参考图一的海报里',
    hasReferences: true,
    referenceCount: 2,
    referenceStrength: 0.9,
    referenceMode: 'product',
    referencePriority: 'first',
    referenceRoleMode: 'none',
  })

  assert.match(prompt, /\[Reference Grounding\]/)
  assert.doesNotMatch(prompt, /\[Consistency Requirements\]/)
  assert.doesNotMatch(prompt, /\[Style Requirements\]/)
  assert.doesNotMatch(prompt, /\[Poster Reconstruction Mode\]/)
})

test('buildConstrainedPrompt emits poster-product contract with ref1 layout and ref2 product', () => {
  const prompt = buildConstrainedPrompt('重做成商品海报', {
    strength: 0.9,
    mode: 'product',
    referenceRoleMode: 'poster-product',
    referenceCount: 2,
    priority: 'all',
    approvedSummary: '上一版构图已经确认',
    forbiddenChanges: ['不要改变产品包装配色'],
  })

  assert.match(prompt, /\[Poster Reconstruction Mode\]/)
  assert.match(prompt, /Reference image 1 is the poster\/layout anchor\./)
  assert.match(prompt, /Reference image 2 is the product identity anchor\./)
  assert.match(prompt, /\[Approved Anchor\]/)
  assert.match(prompt, /\[Forbidden Changes\]/)
})

test('buildReferenceGroundingPrompt infers explicit ref1-layout ref2-product assignment from wording', () => {
  const prompt = buildReferenceGroundingPrompt(
    '参考图一做海报构图，参考图二做产品主体和品牌包装',
    { referenceCount: 2 },
  )

  assert.match(prompt, /\[Explicit Reference Role Assignment\]/)
  assert.match(prompt, /Reference image 1 is the layout\/style\/composition anchor\./)
  assert.match(prompt, /Reference image 2 is the product identity and branding anchor\./)
})

test('buildReferenceInjectionPlan repeats first reference by strength when priority is first', () => {
  const plan = buildReferenceInjectionPlan({
    references: ['ref-a', 'ref-b', 'ref-c'],
    referenceStrength: 0.9,
    referenceMode: 'product',
    referencePriority: 'first',
  })

  assert.equal(plan.strength, 0.9)
  assert.equal(plan.priority, 'first')
  assert.equal(plan.repeats, 3)
  assert.deepEqual(plan.referencesToInject, ['ref-a', 'ref-a', 'ref-a', 'ref-b', 'ref-c'])
})

test('buildTextPolicySuffix merges Chinese-only and exact-copy rules under one header', () => {
  const suffix = buildTextPolicySuffix({
    enforceChinese: true,
    requiredCopy: '夏日上新',
  })

  assert.equal((suffix.match(/\[Text Rendering Rules\]/g) || []).length, 1)
  assert.match(suffix, /Chinese only/i)
  assert.match(suffix, /夏日上新/)
})
