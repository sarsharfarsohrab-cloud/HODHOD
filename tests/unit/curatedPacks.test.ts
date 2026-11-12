import { describe, expect, test } from 'bun:test'
import { buildPractice, type PracticeEntry } from '../../src/core/packPractice.ts'
import { packProgress } from '../../src/core/packs.ts'
import saved from '../../content/packs/curated.json'
import { buildCurated, conjugate, seedSql } from '../../content/packs/curated/build.ts'

describe('hand-written packs', () => {
  const packs = buildCurated()
  const words = packs.find((p) => p.slug === 'restaurant-words')!
  const talk = packs.find((p) => p.slug === 'restaurant-talk')!

  test('every card passes the card schema (buildCurated throws otherwise)', () => {
    expect(words.items.length).toBeGreaterThanOrEqual(100)
    expect(talk.items.length).toBeGreaterThanOrEqual(40)
    expect(words.lesson_titles.length).toBe(12)
    expect(talk.lesson_titles.length).toBe(9)
  })

  test('the files in the repository are the ones the script writes', () => {
    expect(JSON.parse(JSON.stringify(packs))).toEqual(saved as unknown)
  })

  test('a word has one sentence to listen to; a sentence card carries who says it and when', () => {
    for (const item of words.items) expect(item.content.meanings[0]!.examples.length).toBe(1)
    for (const item of talk.items) {
      expect(item.content.pos).toBe('sentence')
      expect(item.hint).toBeTruthy()
      expect(item.content.notes).toBeTruthy()
    }
  })

  test('every group has its entries, numbered from 1 without gaps', () => {
    for (const pack of packs) {
      const lessons = [...new Set(pack.items.map((i) => i.lesson))]
      expect(lessons).toEqual(pack.lesson_titles.map((_, i) => i + 1))
      expect(pack.items.map((i) => i.position)).toEqual(pack.items.map((_, i) => i))
    }
  })

  test('verbs are conjugated from their principal parts', () => {
    const essen = conjugate('essen', { p2: 'gegessen', du: 'isst', er: 'isst', prat: 'aß', k2: 'äß', imp: 'iss' })
    expect(essen.praesens).toEqual(['esse', 'isst', 'isst', 'essen', 'esst', 'essen'])
    expect(essen.praeteritum).toEqual(['aß', 'aßt', 'aß', 'aßen', 'aßt', 'aßen'])
    expect(essen.imperativ).toEqual({ du: 'iss', ihr: 'esst', Sie: 'essen Sie' })
    const warten = conjugate('warten', { p2: 'gewartet' })
    expect(warten.praesens).toEqual(['warte', 'wartest', 'wartet', 'warten', 'wartet', 'warten'])
    expect(warten.praeteritum[1]).toBe('wartetest')
    const einladen = conjugate('einladen', { p2: 'eingeladen', sep: 'ein', du: 'lädst', er: 'lädt', prat: 'lud', k2: 'lüd' })
    expect(einladen.separable).toBe(true)
    expect(einladen.praesens.slice(0, 3)).toEqual(['lade ein', 'lädst ein', 'lädt ein'])
    expect(einladen.imperativ.Sie).toBe('laden Sie ein')
    expect(conjugate('bringen', { p2: 'gebracht', pratWeak: 'brach', k2Weak: 'bräch' }).konjunktiv2[0]).toBe('brächte')
  })

  test('the seed adds the packs unpublished and can be run again', () => {
    const sql = seedSql(packs)
    expect(sql).toContain('add column if not exists lesson_titles')
    expect(sql).toContain('on conflict (slug) do update')
    expect(sql).toContain('on conflict (pack_id, position) do update')
    expect(sql).not.toMatch(/published = excluded/)
    expect(sql.match(/, false, 'de', 'fa'\)/g)?.length).toBe(packs.length)
  })
})

describe('practice of a pack group', () => {
  const entries: PracticeEntry[] = [
    { id: '1', word: 'der Tisch', meaning: 'میز' },
    { id: '2', word: 'der Stuhl', meaning: 'صندلی' },
    { id: '3', word: 'das Glas', meaning: 'لیوان' },
    { id: '4', word: 'die Tasse', meaning: 'فنجان' },
    { id: '5', word: 'die Gabel', meaning: 'چنگال' },
  ]
  const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)

  test('every word is asked once, with the right answer among three distinct choices', () => {
    const questions = buildPractice(entries, seeded(7))
    expect(questions.map((q) => q.entry.id).sort()).toEqual(['1', '2', '3', '4', '5'])
    for (const q of questions) {
      expect(q.options.length).toBe(3)
      expect(q.options.filter((o) => o.id === q.entry.id).length).toBe(1)
      expect(new Set(q.options.map((o) => o.id)).size).toBe(3)
    }
    expect(new Set(questions.map((q) => q.kind))).toEqual(new Set(['meaning', 'word', 'listen']))
  })

  test('a choice never shares the right answer’s meaning; one word alone gives no practice', () => {
    const twins = [...entries, { id: '6', word: 'der Becher', meaning: 'لیوان' }]
    for (const q of buildPractice(twins, seeded(3))) {
      expect(q.options.filter((o) => o.meaning === q.entry.meaning).length).toBe(1)
    }
    expect(buildPractice(entries.slice(0, 1))).toEqual([])
  })
})

describe('a pack of named groups', () => {
  test('no group waits for the one before', () => {
    const entries = [
      { id: 'a', lesson: 1, lemma: 'Tisch', pos: 'noun' },
      { id: 'b', lesson: 2, lemma: 'Stuhl', pos: 'noun' },
    ]
    const none = () => undefined
    expect(packProgress(entries, none, () => []).lessons.map((l) => l.state)).toEqual(['open', 'locked'])
    expect(packProgress(entries, none, () => [], true).lessons.map((l) => l.state)).toEqual(['open', 'open'])
  })
})
