/**
 * Rules for what may be typed into "create word": one German word, a fixed expression
 * such as "Bescheid sagen" or "jdm. auf die Nerven gehen", or a short everyday sentence
 * ("Kannst du mir kurz helfen?").
 * Shared by the client (instant feedback) and the AI function (never trust the client).
 */

/** Words and expressions. */
export const MAX_INPUT_LENGTH = 60
/** Up to this many words the entry is treated as a word or expression; above, as a sentence. */
export const MAX_INPUT_WORDS = 5
export const MAX_SENTENCE_LENGTH = 200
export const MAX_SENTENCE_WORDS = 20

export type InputErrorCode =
  | 'empty'
  | 'too_long'
  | 'multiple_words'
  | 'wrong_script'
  | 'invalid_characters'

export type InputKind = 'word' | 'sentence'

export type InputResult =
  | { ok: true; value: string; cacheKey: string; kind: InputKind }
  | { ok: false; code: InputErrorCode }

/** Articles a learner may type in front of a noun; ignored when looking for duplicates. */
const ARTICLES = new Set(['der', 'die', 'das', 'ein', 'eine'])

const PERSIAN_ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/
/** Latin letters (incl. umlauts and accents used in loanwords), inner hyphen or apostrophe. */
const TOKEN = /^\p{Script=Latin}+(?:[-'’]\p{Script=Latin}+)*$/u
/** Dictionary placeholders that may appear inside expressions. */
const ABBREVIATION = /^(?:jdn|jdm|jds|jd|etw|bzw|usw|ca|z|B|d|h|o|ä|Dr|Fr|Hr|Nr|Str|bzgl|evtl|ggf|inkl|vgl)\.$/u
/** Characters allowed in a sentence besides letters and digits. */
const SENTENCE_CHARS = /^[\p{Script=Latin}\p{Nd}\s.,:!?'’"„“”‚‘«»()\-–—…/%€]+$/u
const EDGE_PUNCTUATION = /^[\s"'„“”‚‘’«»()[\].,;:!?…]+|[\s"'„“”‚‘’«»()[\].,;:!?…]+$/g
/** Leading quotes and bullets only; a sentence keeps its final ".", "?" or "!". */
const SENTENCE_EDGES = /^[\s"'„“”‚‘’«»(\-–—•*·]+|[\s"'„“”‚‘’«»)]+$/g

export function cleanInput(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '') // zero-width + bidi marks
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .trim()
}

function cleanSentence(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(SENTENCE_EDGES, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

export function validateWordInput(raw: unknown): InputResult {
  if (typeof raw !== 'string') return { ok: false, code: 'empty' }
  const value = cleanInput(raw)
  if (value.length === 0) return { ok: false, code: 'empty' }
  if (PERSIAN_ARABIC.test(value)) return { ok: false, code: 'wrong_script' }

  const tokens = value.split(' ')
  const sentenceLike =
    tokens.length > MAX_INPUT_WORDS || /[,!?]/.test(value) || (tokens.length >= 2 && /[.!?]["'“”»]?\s*$/.test(raw.trim()))
  if (!sentenceLike) {
    for (const token of tokens) if (!TOKEN.test(token) && !ABBREVIATION.test(token)) return { ok: false, code: 'invalid_characters' }
    if (value.length > MAX_INPUT_LENGTH) return { ok: false, code: 'too_long' }
    return { ok: true, value, cacheKey: value.toLocaleLowerCase('de'), kind: 'word' }
  }

  // Longer entries, or entries with punctuation inside ("Na, und?"): a sentence or a set phrase.
  const sentence = cleanSentence(raw)
  if (!SENTENCE_CHARS.test(sentence) || !/\p{Script=Latin}/u.test(sentence)) return { ok: false, code: 'invalid_characters' }
  if (sentence.length > MAX_SENTENCE_LENGTH) return { ok: false, code: 'too_long' }
  const words = sentence.split(' ').filter((w) => /[\p{Script=Latin}\p{Nd}]/u.test(w))
  if (words.length > MAX_SENTENCE_WORDS) return { ok: false, code: 'multiple_words' }
  return { ok: true, value: sentence, cacheKey: cleanInput(sentence).toLocaleLowerCase('de'), kind: words.length > MAX_INPUT_WORDS ? 'sentence' : 'word' }
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
  const keep = (entry: string) => {
    // single letters and stray articles are leftovers of list formatting ("Tisch, -e", "Tisch, der")
    if (entry.length < 2 || ARTICLES.has(entry.toLowerCase())) return
    // "der Tisch" and "tisch" are the same entry; the first spelling wins
    const key = cleanInput(stripArticle(entry)).toLocaleLowerCase('de')
    if (seen.has(key)) return
    seen.add(key)
    out.push(entry)
  }
  // a plural ending after the noun, as textbooks print it: "das Haus, ¨-er", "der Tisch, -e"
  const withoutEndings = text.replace(/[,،]\s*[¨"]?[-–]\p{L}{0,3}(?=\s*(?:$|[\n\r,;،؛(]))/gmu, '')
  for (const rawLine of withoutEndings.split(/[\n\r]+/)) {
    const line = rawLine
      .replace(/،/g, ',')
      .replace(/؛/g, ';')
      .replace(/^\s*(?:[-–—•*·▪◦]+|\(?\d+[.)]|\d+\s*[-–])\s*/, '') // "- ", "• ", "1. ", "2) "
      .replace(/\s+[-–—=→]\s+.*$/, '') // "Tisch - میز"
      .replace(/\s*\((?:Akk|Dat|Nom|Gen|pl|Pl|sg|Sg)\.?[^)]*\)\s*/g, ' ') // "(pl. Tische)", "(Akk.)"
      .replace(/[\u0600-\u06FF].*$/, '') // a Persian translation after the word
    const words = line.trim().split(/\s+/).filter(Boolean)
    if (words.length > MAX_INPUT_WORDS) {
      // a sentence stays one entry, commas and all
      const sentence = cleanSentence(line)
      if (sentence) keep(sentence)
      continue
    }
    for (const part of line.split(/[,;،؛]+/)) {
      const entry = cleanInput(part.replace(/\s*\(.*?\)\s*/g, ' '))
      keep(entry)
    }
  }
  return out
}
