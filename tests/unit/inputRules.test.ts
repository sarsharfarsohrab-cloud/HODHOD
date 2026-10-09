import { describe, expect, test } from 'bun:test'
import { normalizeLemma, stripArticle, validateWordInput } from '../../supabase/functions/_shared/inputRules.ts'

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
  test('does not silently analyse two words', () => {
    expect(code('aufgeben gehen')).toBe('multiple_words')
    expect(code('ich gehe nach Hause')).toBe('multiple_words')
    expect(code('der große Tisch')).toBe('multiple_words')
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
    expect(code('a'.repeat(41))).toBe('too_long')
    expect(code('a'.repeat(40))).toBe('ok')
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
