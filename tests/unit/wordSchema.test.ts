import { describe, expect, test } from 'bun:test'
import { aiOutputToContentInput } from '../../supabase/functions/_shared/prompt.ts'
import { displayWord, validateWordContent, type WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { asAiOutput, AUFGEBEN, SCHNELL, TISCH } from '../fixtures/words.ts'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const issues = (input: unknown, mode: 'ai' | 'user' = 'ai') => {
  const r = validateWordContent(input, { mode })
  return r.ok ? [] : r.issues.map((i) => `${i.path}:${i.code}`)
}

describe('word content validation', () => {
  test('accepts complete verb, noun and adjective drafts', () => {
    for (const w of [AUFGEBEN, TISCH, SCHNELL]) {
      const r = validateWordContent(w, { mode: 'ai' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.value).toEqual(w)
    }
  })
  test('accepts the model shape after mapping', () => {
    for (const w of [AUFGEBEN, TISCH, SCHNELL]) {
      expect(validateWordContent(aiOutputToContentInput(asAiOutput(w)), { mode: 'ai' }).ok).toBe(true)
    }
  })
  test('rejects non-objects', () => {
    for (const v of [null, 'x', 3, [], undefined]) expect(validateWordContent(v, { mode: 'ai' }).ok).toBe(false)
  })
  test('requires lemma, part of speech and at least one meaning', () => {
    expect(issues({ ...TISCH, lemma: ' ' })).toContain('lemma:required')
    expect(issues({ ...TISCH, pos: 'thing' })).toContain('pos:invalid_value')
    expect(issues({ ...TISCH, meanings: [] })).toContain('meanings:required')
  })
  test('a Persian lemma or a German "translation" is the wrong way round', () => {
    expect(issues({ ...TISCH, lemma: 'میز' })).toContain('lemma:wrong_script')
    const w = clone(TISCH)
    w.meanings[0]!.translation = 'table'
    expect(issues(w)).toContain('meanings.0.translation:wrong_script')
  })
  test('AI drafts need exactly one example of each level', () => {
    const two = clone(TISCH)
    two.meanings[0]!.examples.pop()
    expect(issues(two)).toContain('meanings.0.examples:missing_levels')
    const sameLevel = clone(TISCH)
    sameLevel.meanings[0]!.examples[2]!.level = 'easy'
    expect(issues(sameLevel)).toContain('meanings.0.examples:missing_levels')
  })
  test('a learner may remove examples but not leave a broken one', () => {
    const w = clone(TISCH)
    w.meanings[0]!.examples = [w.meanings[0]!.examples[0]!]
    expect(issues(w, 'user')).toEqual([])
    w.meanings[0]!.examples[0]!.fa = ''
    expect(issues(w, 'user')).toContain('meanings.0.examples.0.fa:required')
  })
  test('nouns need an article unless they are plural-only', () => {
    expect(issues({ ...TISCH, noun: null })).toContain('noun:required')
    expect(issues({ ...TISCH, noun: { ...TISCH.noun, article: 'den' } })).toContain('noun.article:invalid_value')
    const eltern = { ...TISCH, lemma: 'Eltern', noun: { article: null, plural: null, genitive: null, pluralOnly: true } }
    const r = validateWordContent(eltern, { mode: 'ai' })
    expect(r.ok && r.value.noun?.article).toBe('die')
  })
  test('verbs need six forms in every simple tense', () => {
    const w = clone(AUFGEBEN)
    w.verb!.praeteritum = ['gab auf', 'gabst auf', 'gab auf'] as unknown as WordContent['verb'] extends infer V ? V extends { praeteritum: infer P } ? P : never : never
    expect(issues(w)).toContain('verb.praeteritum:invalid_value')
    const empty = clone(AUFGEBEN)
    empty.verb!.konjunktiv2[3] = ' '
    expect(issues(empty)).toContain('verb.konjunktiv2:invalid_value')
    expect(issues({ ...AUFGEBEN, verb: null })).toContain('verb:required')
    expect(issues({ ...AUFGEBEN, verb: { ...AUFGEBEN.verb, auxiliary: 'werden' } })).toContain('verb.auxiliary:invalid_value')
    expect(issues({ ...AUFGEBEN, verb: { ...AUFGEBEN.verb, partizip2: '' } })).toContain('verb.partizip2:required')
  })
  test('the imperative is all or nothing (modal verbs have none)', () => {
    const none = { ...AUFGEBEN, verb: { ...AUFGEBEN.verb, imperativ: { du: '', ihr: '', Sie: '' } } }
    expect(issues(none)).toEqual([])
    const half = { ...AUFGEBEN, verb: { ...AUFGEBEN.verb, imperativ: { du: 'Gib auf!', ihr: '', Sie: '' } } }
    expect(issues(half)).toContain('verb.imperativ:invalid_value')
  })
  test('grammar blocks that do not belong to the part of speech are dropped, not shown', () => {
    const r = validateWordContent({ ...TISCH, verb: AUFGEBEN.verb, adjective: SCHNELL.adjective }, { mode: 'ai' })
    expect(r.ok && r.value.verb).toBe(null)
    expect(r.ok && r.value.adjective).toBe(null)
  })
  test('limits: too many meanings, oversized text', () => {
    const m = TISCH.meanings[0]!
    expect(issues({ ...TISCH, meanings: [m, m, m, m] })).toContain('meanings:too_many')
    expect(issues({ ...TISCH, notes: 'ن'.repeat(601) })).toContain('notes:too_long')
    expect(issues({ ...TISCH, synonyms: Array.from({ length: 9 }, (_, i) => `w${'a'.repeat(i + 1)}`) })).toContain('synonyms:too_many')
  })
  test('cleans whitespace, empty optionals and duplicate list entries', () => {
    const r = validateWordContent(
      { ...TISCH, ipa: '  ', notes: '', synonyms: ['Tafel', ' tafel ', ''], collocations: [{ de: '', fa: '' }] },
      { mode: 'ai' },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.ipa).toBe(null)
      expect(r.value.notes).toBe(null)
      expect(r.value.synonyms).toEqual(['Tafel'])
      expect(r.value.collocations).toEqual([])
    }
  })
  test('unknown keys never reach the stored document', () => {
    const r = validateWordContent({ ...TISCH, __proto__: { x: 1 }, evil: '<script>', meanings: [{ ...TISCH.meanings[0], extra: 1 }] }, { mode: 'ai' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect('evil' in r.value).toBe(false)
      expect('extra' in r.value.meanings[0]!).toBe(false)
    }
  })
  test('displayWord puts the article in front of nouns only', () => {
    expect(displayWord(TISCH)).toBe('der Tisch')
    expect(displayWord(AUFGEBEN)).toBe('aufgeben')
  })
})
