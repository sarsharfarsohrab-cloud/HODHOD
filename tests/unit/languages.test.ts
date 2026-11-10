import { describe, expect, test } from 'bun:test'
import { aiOutputToContentInput, buildMessages, isSupportedPair, outputSchema } from '../../supabase/functions/_shared/prompt.ts'
import { displayWord, validateWordContent } from '../../supabase/functions/_shared/wordSchema.ts'

const examples = (text: string, translation: string) => [
  { level: 'easy', text, translation },
  { level: 'medium', text, translation },
  { level: 'hard', text, translation },
]

/** A model answer for a French noun, as the AI returns it. */
const ARBRE = {
  status: 'ok',
  suggestion: null,
  input_note: null,
  lemma: 'arbre',
  pos: 'noun',
  cefr: 'A1',
  ipa: 'aʁbʁ',
  meanings: [{ translation: 'дерево', note: null, examples: examples('Il y a un arbre dans le jardin.', 'У саду є дерево.') }],
  noun: { article: "l'", gender: 'm', plural: 'arbres', plural_only: false },
  verb: null,
  conjugation: null,
  adjective: null,
  synonyms: [],
  antonyms: [],
  collocations: [{ text: 'un arbre fruitier', translation: 'фруктове дерево' }],
  learner_note: null,
  register: 'neutral',
  frequency: 3,
  literal: null,
  alternatives: [],
  reply: null,
}

const persons = ['I', 'you', 'he/she/it', 'we', 'you (pl.)', 'they']
const GIVE_UP = {
  ...ARBRE,
  lemma: 'give up',
  pos: 'verb',
  ipa: 'ɡɪv ʌp',
  meanings: [{ translation: 'vazgeçmek', note: null, examples: examples('Never give up!', 'Asla vazgeçme!') }],
  noun: null,
  collocations: [],
  conjugation: {
    auxiliary: 'have',
    irregular: true,
    separable: false,
    reflexive: false,
    participle: 'given up',
    government: null,
    tenses: [
      { name: 'Present simple', forms: persons.map((person, i) => ({ person, form: i === 2 ? 'gives up' : 'give up' })) },
      { name: 'Past simple', forms: persons.map((person) => ({ person, form: 'gave up' })) },
    ],
  },
}

describe('language pairs', () => {
  test('every learned language with every other own language is offered, never a language with itself', () => {
    expect(isSupportedPair({ target: 'de', native: 'fa' })).toBe(true)
    expect(isSupportedPair({ target: 'fr', native: 'uk' })).toBe(true)
    expect(isSupportedPair({ target: 'nl', native: 'ar' })).toBe(true)
    expect(isSupportedPair({ target: 'en', native: 'en' })).toBe(false)
    expect(isSupportedPair({ target: 'tr', native: 'de' })).toBe(false)
  })

  test('the prompt names both languages and the learned language’s own grammar', () => {
    const { system, user } = buildMessages({ target: 'it', native: 'tr' }, 'libro')
    expect(system).toContain('Italian lexicographer')
    expect(system).toContain('native Turkish speakers')
    expect(system).toContain('passato prossimo')
    expect(system).not.toContain('Persian')
    expect(user).toContain('Italian entry: "libro"')
    expect(buildMessages({ target: 'de', native: 'fa' }, 'Tisch').system).toContain('Konjunktiv II')
  })

  test('the output schema follows the learned language', () => {
    const de = outputSchema('de') as { properties: Record<string, unknown> }
    const fr = outputSchema('fr') as { properties: Record<string, unknown> }
    expect(JSON.stringify(de.properties.verb)).toContain('konjunktiv2')
    expect(fr.properties.verb).toEqual({ type: 'null' })
    expect(JSON.stringify(fr.properties.noun)).toContain("l'")
    expect(JSON.stringify(outputSchema('en').properties)).not.toContain('"le"')
  })
})

describe('cards in other languages', () => {
  test('a French noun with an elided article, explained in Ukrainian', () => {
    const r = validateWordContent(aiOutputToContentInput(ARBRE), { mode: 'ai', target: 'fr', native: 'uk' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.noun).toEqual({ article: "l'", gender: 'm', plural: 'arbres', genitive: null, pluralOnly: false })
    expect(r.value.meanings[0]!.examples[0]).toEqual({ level: 'easy', de: 'Il y a un arbre dans le jardin.', fa: 'У саду є дерево.' })
    expect(r.value.collocations[0]).toEqual({ de: 'un arbre fruitier', fa: 'фруктове дерево' })
    expect(displayWord(r.value)).toBe("l'arbre")
  })

  test('meanings must be in the script of the learner’s language', () => {
    const r = validateWordContent(aiOutputToContentInput({ ...ARBRE, meanings: [{ ...ARBRE.meanings[0], translation: 'tree' }] }), {
      mode: 'ai',
      target: 'fr',
      native: 'uk',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues.map((i) => `${i.path}:${i.code}`)).toContain('meanings.0.translation:wrong_script')
  })

  test('the stated gender wins over the article: Spanish "el agua" is feminine', () => {
    const agua = { ...ARBRE, lemma: 'agua', noun: { article: 'el', gender: 'f', plural: 'aguas', plural_only: false } }
    const r = validateWordContent(aiOutputToContentInput(agua), { mode: 'ai', target: 'es', native: 'de' })
    expect(r.ok && r.value.noun?.gender).toBe('f')
  })

  test('articles of another language are refused; English nouns have none', () => {
    const wrong = { ...ARBRE, noun: { article: 'der', gender: 'm', plural: 'arbres', plural_only: false } }
    expect(validateWordContent(aiOutputToContentInput(wrong), { mode: 'ai', target: 'fr', native: 'de' }).ok).toBe(false)
    const table = { ...ARBRE, lemma: 'table', noun: { article: null, gender: null, plural: 'tables', plural_only: false } }
    const r = validateWordContent(aiOutputToContentInput(table), { mode: 'ai', target: 'en', native: 'de' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(displayWord(r.value)).toBe('table')
  })

  test('verbs of other languages keep their tenses as written', () => {
    const r = validateWordContent(aiOutputToContentInput(GIVE_UP), { mode: 'ai', target: 'en', native: 'tr' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.verb).toBe(null)
    expect(r.value.conjugation?.tenses.map((t) => t.name)).toEqual(['Present simple', 'Past simple'])
    expect(r.value.conjugation?.tenses[0]!.forms[2]).toEqual({ person: 'he/she/it', form: 'gives up' })
  })

  test('a verb without its tenses is refused', () => {
    const r = validateWordContent(aiOutputToContentInput({ ...GIVE_UP, conjugation: { ...GIVE_UP.conjugation, tenses: [] } }), {
      mode: 'ai',
      target: 'en',
      native: 'tr',
    })
    expect(r.ok).toBe(false)
  })
})

import { contentFromRow, parseDeck } from '../../src/core/deckImport.ts'

describe('importing decks in other languages', () => {
  test('Ukrainian meanings are found by their script, in either column', () => {
    const deck = parseDeck('la maison\tбудинок\nкнига\tle livre\n', 'uk')
    expect(deck.rows.map((r) => [r.german, r.persian])).toEqual([['la maison', 'будинок'], ['le livre', 'книга']])
  })
  test('with two Latin-script languages the first column is the learned language', () => {
    const deck = parseDeck('el perro\tthe dog\n', 'en')
    expect(deck.rows[0]).toMatchObject({ german: 'el perro', persian: 'the dog' })
  })
  test('the learned language’s own articles make a noun', () => {
    const c = contentFromRow({ german: 'het huis', persian: 'das Haus', tags: [] }, 'nl', 'de')
    expect(c?.pos).toBe('noun')
    expect(c?.noun).toMatchObject({ article: 'het', gender: 'n' })
    expect(contentFromRow({ german: 'the house', persian: 'das Haus', tags: [] }, 'en', 'de')?.pos).toBe('phrase')
  })
})

import { reminderMessage } from '../../supabase/functions/_shared/push.ts'

describe('reminders in the learner’s own language', () => {
  test('German, Arabic and the Persian default', () => {
    expect(reminderMessage('daily', 3, 0, 'de').body).toBe('3 Karten warten auf dich.')
    expect(reminderMessage('streak', 0, 5, 'ar').body).toContain('راجعت')
    expect(reminderMessage('daily', 12, 0, 'xx').body).toBe('۱۲ کارت منتظرت است.')
  })
})
