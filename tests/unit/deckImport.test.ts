import { describe, expect, test } from 'bun:test'
import { cleanField, contentFromRow, exportDeck, parseDeck, splitLine } from '../../src/core/deckImport.ts'

describe('reading Anki and Quizlet files', () => {
  test('Anki plain-text export with header lines, HTML and tags', () => {
    const file = '#separator:tab\n#html:true\n#tags column:3\nder Tisch\tمیز<br>\tLektion::1 Haus\n<b>aufgeben</b>\tدست کشیدن [sound:a.mp3]\t\n'
    const deck = parseDeck(file)
    expect(deck.separator).toBe('\t')
    expect(deck.rows).toEqual([
      { german: 'der Tisch', persian: 'میز', tags: ['Lektion 1', 'Haus'] },
      { german: 'aufgeben', persian: 'دست کشیدن', tags: [] },
    ])
  })

  test('Quizlet comma export, Persian first, quoted fields and junk lines', () => {
    const deck = parseDeck('میز,der Tisch\n"خانه، منزل","das Haus"\nnur deutsch,\n\n"Wie geht\'s, dir?",حالت چطور است؟')
    expect(deck.rows.map((r) => [r.german, r.persian])).toEqual([
      ['der Tisch', 'میز'],
      ['das Haus', 'خانه، منزل'],
      ["Wie geht's, dir?", 'حالت چطور است؟'],
    ])
    expect(deck.skipped).toBe(1)
  })

  test('fields', () => {
    expect(splitLine('a,"b, c",d', ',')).toEqual(['a', 'b, c', 'd'])
    expect(splitLine('"say ""hi""",x', ',')).toEqual(['say "hi"', 'x'])
    expect(cleanField('{{c1::Hund::animal}} &amp; Katze&nbsp;')).toBe('Hund & Katze')
  })
})

describe('cards from rows', () => {
  test('nouns keep their article in every common spelling', () => {
    expect(contentFromRow({ german: 'der Tisch', persian: 'میز', tags: [] })).toMatchObject({ lemma: 'Tisch', pos: 'noun', noun: { article: 'der' } })
    expect(contentFromRow({ german: 'Tisch, der, Tische', persian: 'میز', tags: [] })).toMatchObject({ lemma: 'Tisch', noun: { article: 'der', plural: 'Tische' } })
    expect(contentFromRow({ german: 'die Lampe, -n', persian: 'چراغ', tags: [] })).toMatchObject({ lemma: 'Lampe', noun: { article: 'die', plural: null } })
  })

  test('other entries', () => {
    expect(contentFromRow({ german: 'schnell', persian: 'سریع', tags: [] })?.pos).toBe('other')
    expect(contentFromRow({ german: 'Bescheid sagen', persian: 'خبر دادن', tags: [] })?.pos).toBe('phrase')
    expect(contentFromRow({ german: 'Kannst du mir helfen?', persian: 'می‌توانی کمکم کنی؟', tags: [] })?.pos).toBe('sentence')
  })

  test('export for Anki', () => {
    const tisch = contentFromRow({ german: 'der Tisch', persian: 'میز', tags: [] })!
    expect(exportDeck([{ content: tisch, tags: ['Lektion 1'] }])).toBe('#separator:tab\n#html:false\n#tags column:3\nder Tisch\tمیز\tLektion_1\n')
  })
})
