/**
 * Rules for the single-word input of the "create word" flow.
 * Shared by the client (instant feedback) and the AI function (never trust the client).
 */

export const MAX_INPUT_LENGTH = 40

export type InputErrorCode =
  | 'empty'
  | 'too_long'
  | 'multiple_words'
  | 'wrong_script'
  | 'invalid_characters'

export type InputResult =
  | { ok: true; value: string; cacheKey: string }
  | { ok: false; code: InputErrorCode }

/** Leading words that are allowed in front of the actual word. */
const ARTICLES = new Set(['der', 'die', 'das', 'ein', 'eine'])
const REFLEXIVE = 'sich'

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

  if (tokens.length > 2) return { ok: false, code: 'multiple_words' }
  if (tokens.length === 2) {
    const lead = tokens[0]!.toLowerCase()
    if (!ARTICLES.has(lead) && lead !== REFLEXIVE) {
      return { ok: false, code: 'multiple_words' }
    }
  }

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
