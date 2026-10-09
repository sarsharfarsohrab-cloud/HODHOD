import { describe, expect, test } from 'bun:test'
import { normalizeLemma, splitWordList, stripArticle, validateWordInput } from '../../supabase/functions/_shared/inputRules.ts'

const code = (raw: unknown) => {
  const r = validateWordInput(raw)
  return r.ok ? 'ok' : r.code
}

describe('word input', () => {
  test('accepts a single German word and trims it', () => {
    expect(validateWordInput('  aufgeben \n')).toEqual({ ok: true, value: 'aufgeben', cacheKey: 'aufgeben' })
  })
  test('accepts umlauts, ß, hyphens and loanword accents', () => {
    for (const w of ['Straße', 'Äpfel', 'über', 'E-Mail', 'Café', "geht's"]) expect(code(w)).toBe('ok')
  })
  test('accepts an article or "sich" in front of the word', () => {
    expect(code('der Tisch')).toBe('ok')
    expect(code('Die  Lampe')).toBe('ok')
    expect(code('sich freuen')).toBe('ok')
  })
  test('rejects empty input', () => {
    for (const w of ['', '   ', '‌', '...', null, undefined, 42]) expect(code(w)).toBe('empty')
  })
  test('accepts short fixed expressions', () => {
    for (const w of ['Bescheid sagen', 'auf jeden Fall', 'sich Sorgen machen', 'zum Beispiel', 'es geht um']) expect(code(w)).toBe('ok')
  })
  test('refuses whole sentences (more than five words)', () => {
    expect(code('ich gehe heute Abend nach Hause')).toBe('multiple_words')
    expect(code('eins zwei drei vier fünf')).toBe('ok')
  })
  test('rejects Persian and mixed-script input', () => {
    expect(code('میز')).toBe('wrong_script')
    expect(code('Tischمیز')).toBe('wrong_script')
  })
  test('rejects digits, symbols and markup', () => {
    for (const w of ['Tisch2', 'a+b', '<b>Tisch</b>', 'Tisch;drop', 'user@example', '😀']) {
      expect(code(w)).toBe('invalid_characters')
    }
  })
  test('rejects very long input', () => {
    expect(code('a'.repeat(61))).toBe('too_long')
    expect(code('a'.repeat(60))).toBe('ok')
  })
  test('strips quotes and trailing punctuation', () => {
    expect(validateWordInput('„Tisch“.')).toEqual({ ok: true, value: 'Tisch', cacheKey: 'tisch' })
  })
  test('normalises composed characters so ä typed two ways is one word', () => {
    const decomposed = 'äpfel'
    const r = validateWordInput(decomposed)
    expect(r.ok && r.value).toBe('äpfel')
  })
  test('duplicate key keeps German capitalisation', () => {
    expect(normalizeLemma(' Essen ')).toBe('Essen')
    expect(normalizeLemma('essen')).not.toBe(normalizeLemma('Essen'))
  })
  test('stripArticle', () => {
    expect(stripArticle('der Tisch')).toBe('Tisch')
    expect(stripArticle('Tisch')).toBe('Tisch')
    expect(stripArticle('sich freuen')).toBe('sich freuen')
  })
})

describe('splitting a pasted or scanned list', () => {
  test('one entry per line, comma or semicolon', () => {
    expect(splitWordList('Tisch\nLampe, Stuhl; Fenster')).toEqual(['Tisch', 'Lampe', 'Stuhl', 'Fenster'])
    expect(splitWordList('Tisch،Lampe؛Stuhl')).toEqual(['Tisch', 'Lampe', 'Stuhl'])
  })
  test('drops bullets, numbering and empty lines', () => {
    expect(splitWordList('1. aufgeben\n2) der Tisch\n\n- schnell\n• Bescheid sagen\n3 - laufen')).toEqual(['aufgeben', 'der Tisch', 'schnell', 'Bescheid sagen', 'laufen'])
  })
  test('keeps the German side of a two-column vocabulary list', () => {
    expect(splitWordList('der Tisch - میز\naufgeben = تسلیم شدن\nschnell: سریع\nLampe چراغ')).toEqual(['der Tisch', 'aufgeben', 'schnell', 'Lampe'])
  })
  test('ignores grammar hints in brackets and list leftovers', () => {
    expect(splitWordList('der Tisch (pl. Tische)\ndas Haus, -er\nLampe, die')).toEqual(['der Tisch', 'das Haus', 'er', 'Lampe'])
    expect(splitWordList('Lampe, die')).toEqual(['Lampe'])
    expect(splitWordList('das Haus, -e')).toEqual(['das Haus'])
  })
  test('removes repeats regardless of capitalisation and keeps the first spelling', () => {
    expect(splitWordList('Tisch\ntisch\nTISCH\nLampe')).toEqual(['Tisch', 'Lampe'])
  })
  test('a compound with a hyphen stays one entry', () => {
    expect(splitWordList('E-Mail\nU-Bahn')).toEqual(['E-Mail', 'U-Bahn'])
  })
  test('nothing usable gives an empty list', () => {
    expect(splitWordList('  \n ,, ; \n میز')).toEqual([])
  })
})
