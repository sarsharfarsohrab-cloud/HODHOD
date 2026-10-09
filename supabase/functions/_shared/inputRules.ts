/**
 * Rules for what may be typed into "create word": one German word, or a short fixed
 * expression such as "Bescheid sagen" or "auf jeden Fall".
 * Shared by the client (instant feedback) and the AI function (never trust the client).
 */

export const MAX_INPUT_LENGTH = 60
/** A lexical unit, not a sentence: the AI decides whether the words belong together. */
export const MAX_INPUT_WORDS = 5

export type InputErrorCode =
  | 'empty'
  | 'too_long'
  | 'multiple_words'
  | 'wrong_script'
  | 'invalid_characters'

export type InputResult =
  | { ok: true; value: string; cacheKey: string }
  | { ok: false; code: InputErrorCode }

/** Articles a learner may type in front of a noun; ignored when looking for duplicates. */
const ARTICLES = new Set(['der', 'die', 'das', 'ein', 'eine'])

const PERSIAN_ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/
/** Latin letters (incl. umlauts and accents used in loanwords), inner hyphen or apostrophe. */
const TOKEN = /^\p{Script=Latin}+(?:[-'’]\p{Script=Latin}+)*$/u
const EDGE_PUNCTUATION = /^[\s"'„“”‚‘’«»()[\].,;:!?…]+|[\s"'„“”‚‘’«»()[\].,;:!?…]+$/g

export function cleanInput(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '') // zero-width + bidi marks
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .trim()
}

export function validateWordInput(raw: unknown): InputResult {
  if (typeof raw !== 'string') return { ok: false, code: 'empty' }
  const value = cleanInput(raw)
  if (value.length === 0) return { ok: false, code: 'empty' }
  if (value.length > MAX_INPUT_LENGTH) return { ok: false, code: 'too_long' }
  if (PERSIAN_ARABIC.test(value)) return { ok: false, code: 'wrong_script' }

  const tokens = value.split(' ')
  for (const token of tokens) {
    if (!TOKEN.test(token)) return { ok: false, code: 'invalid_characters' }
  }

  if (tokens.length > MAX_INPUT_WORDS) return { ok: false, code: 'multiple_words' }

  return { ok: true, value, cacheKey: value.toLocaleLowerCase('de') }
}

/**
 * The form used to detect duplicates. Capitalisation is kept on purpose:
 * in German "essen" (verb) and "Essen" (noun) are different words.
 */
export function normalizeLemma(lemma: string): string {
  return cleanInput(lemma)
}

/** Strips a leading article so "der Tisch" and "Tisch" compare equal. */
export function stripArticle(value: string): string {
  const tokens = cleanInput(value).split(' ')
  if (tokens.length === 2 && ARTICLES.has(tokens[0]!.toLowerCase())) return tokens[1]!
  return tokens.join(' ')
}

/**
 * Splits pasted or scanned text into candidate entries: one per line, or separated by
 * commas / semicolons. Bullets, numbering and anything after " - " or " = " (a translation
 * written next to the word in a vocabulary list) are dropped.
 */
export function splitWordList(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/[\n\r,;،؛]+/)) {
    const entry = cleanInput(
      raw
        .replace(/^\s*(?:[-–—•*·▪◦]+|\(?\d+[.)]|\d+\s*[-–])\s*/, '') // "- ", "• ", "1. ", "2) "
        .replace(/\s+[-–—=:→]\s+.*$/, '') // "Tisch - میز"
        .replace(/\s*\(.*?\)\s*/g, ' ') // "(pl. Tische)"
        .replace(/[\u0600-\u06FF].*$/, ''), // a Persian translation after the word
    )
    // single letters and stray articles are leftovers of list formatting ("Tisch, -e", "Tisch, der")
    if (entry.length < 2 || ARTICLES.has(entry.toLowerCase())) continue
    const key = entry.toLocaleLowerCase('de')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}
