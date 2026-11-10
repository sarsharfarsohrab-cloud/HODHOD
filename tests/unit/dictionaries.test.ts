import { describe, expect, test } from 'bun:test'
import { setLanguage, t } from '../../src/ui/strings.ts'
import { fa } from '../../src/ui/i18n/fa.ts'
import { UI_LANGUAGES } from '../../src/ui/i18n/languages.ts'
import { setLearningPair } from '../../src/ui/learning.ts'

/** Every text of a dictionary, with functions called on sample arguments. */
function texts(value: unknown, path: string, out: Map<string, unknown>) {
  if (typeof value === 'function') {
    if (path.endsWith('.issue')) return out.set(path, (value as (i: unknown) => string)({ path: 'meanings.0.translation', code: 'required' }))
    const args = Array.from({ length: (value as () => unknown).length }, (_, i) => (i === 0 ? 3 : 'x'))
    out.set(path, (value as (...a: unknown[]) => unknown)(...args))
    return
  }
  if (Array.isArray(value)) return out.set(path, value)
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) texts((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, out)
    return
  }
  out.set(path, value)
}

const base = new Map<string, unknown>()
texts({ ...fa, admin: undefined }, '', base)

describe('interface dictionaries', () => {
  for (const code of UI_LANGUAGES) {
    test(`${code}: every text exists and reads without errors`, () => {
      setLearningPair({ target: code === 'de' ? 'en' : 'de', native: code })
      setLanguage(code)
      const got = new Map<string, unknown>()
      texts({ ...t, admin: undefined }, '', got)
      const missing = [...base].filter(([key, value]) => {
        const mine = got.get(key)
        return !got.has(key) || (typeof value === 'string' && !(typeof mine === 'string' && mine.length > 0))
      })
      expect(missing.map(([key]) => key)).toEqual([])
    })
  }

  test('a non-Persian dictionary has no Persian text left in it', () => {
    setLearningPair({ target: 'de', native: 'en' })
    setLanguage('en')
    const got = new Map<string, unknown>()
    texts({ ...t, admin: undefined }, '', got)
    const persian = [...got].filter(([, v]) => /[؀-ۿ]/.test(JSON.stringify(v)))
    expect(persian.map(([k]) => k)).toEqual([])
  })
})
