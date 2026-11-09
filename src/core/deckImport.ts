/**
 * Reading flashcard files exported from Anki ("Notes in Plain Text", .txt/.tsv) or Quizlet
 * (copied/exported text, tab or comma separated), and writing the Word Bank back out in a
 * format Anki can import. Pure functions: no network, no DOM.
 */
import { ARTICLES, CONTENT_VERSION, LIMITS, nativeScript, validateWordContent, type WordContent } from '../../supabase/functions/_shared/wordSchema.ts'

export interface DeckRow {
  /** the side in the learned language (named after the first pair, German–Persian) */
  german: string
  /** the side in the learner's own language */
  persian: string
  tags: string[]
}

export interface ParsedDeck {
  rows: DeckRow[]
  /** Lines that did not contain a German and a Persian side. */
  skipped: number
  separator: '\t' | ';' | ','
}

const LATIN = /\p{Script=Latin}/u

/** Anki fields may contain HTML, sound tags and cloze markers. */
export function cleanField(raw: string): string {
  return raw
    .replace(/\[sound:[^\]]*\]/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\{\{c\d+::([^}:]*)(::[^}]*)?\}\}/g, '$1')
    .normalize('NFC')
    .replace(/[​‎‏﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits one line, honouring "quoted, fields" with doubled quotes inside. */
export function splitLine(line: string, separator: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field.trim() === '') {
      quoted = true
      field = ''
    } else if (ch === separator) {
      out.push(field)
      field = ''
    } else field += ch
  }
  out.push(field)
  return out
}

/** Joins physical lines that belong to one quoted field spanning several lines. */
function logicalLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let open = false
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    current = open ? `${current} ${line}` : line
    const quotes = (line.match(/"/g) ?? []).length
    if (quotes % 2 === 1) open = !open
    if (!open) {
      lines.push(current)
      current = ''
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * When the learner's own language has its own script (Persian, Arabic, Ukrainian, Russian), each
 * side is recognised by its script, in either order. Otherwise the learned language is taken to be
 * the first column and the own language the second, as Anki and Quizlet export them by default.
 */
export function parseDeck(text: string, native = 'fa'): ParsedDeck {
  const script = nativeScript(native)
  const lines = logicalLines(text.replace(/^﻿/, ''))
  let separator: ParsedDeck['separator'] | null = null
  let tagsColumn: number | null = null
  const body: string[] = []
  for (const line of lines) {
    // Anki header lines: "#separator:tab", "#html:true", "#tags column:3"
    const header = /^#([a-z ]+):(.*)$/i.exec(line.trim())
    if (header) {
      const [, key, value] = header
      if (key!.toLowerCase() === 'separator') separator = /tab/i.test(value!) ? '\t' : /semicolon/i.test(value!) ? ';' : /comma/i.test(value!) ? ',' : separator
      if (key!.toLowerCase() === 'tags column') tagsColumn = Number(value) - 1
      continue
    }
    if (line.trim()) body.push(line)
  }
  separator ??= body.some((l) => l.includes('\t')) ? '\t' : body.filter((l) => l.includes(';')).length > body.length / 2 ? ';' : ','

  const rows: DeckRow[] = []
  let skipped = 0
  for (const line of body) {
    const fields = splitLine(line, separator)
    const tags = tagsColumn !== null && fields[tagsColumn] ? fields[tagsColumn]!.trim().split(/\s+/).filter(Boolean).slice(0, 5) : []
    const values = fields.filter((_, i) => i !== tagsColumn).map(cleanField).filter(Boolean)
    // learned language on one side, own language on the other
    const german = script ? values.find((v) => LATIN.test(v) && !script.test(v)) : values[0]
    const persian = script ? values.find((v) => script.test(v)) : values[1]
    if (!german || !persian) {
      skipped++
      continue
    }
    rows.push({ german, persian, tags: tags.map((t) => t.replace(/::/g, ' ').slice(0, 30)) })
  }
  return { rows, skipped, separator }
}

/**
 * A simple card from one row. "der Tisch", "Tisch, der" and "der Tisch, -e" become a
 * noun with its article; longer entries become expressions or sentences.
 */
export function contentFromRow(row: DeckRow, target = 'de', native = 'fa'): WordContent | null {
  let german = row.german.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  let article: string | null = null
  const known = Object.keys(ARTICLES[target] ?? {}).filter((a) => !a.endsWith("'"))
  const alternation = known.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || '(?!)'
  const ARTICLE = new RegExp(`^(${alternation})\\s+(\\S.*)$`, 'i')
  let plural: string | null = null

  const trailing = new RegExp(`^([^,]+),\\s*(${alternation})\\b(?:,\\s*(.+))?$`, 'i').exec(german) // "Tisch, der, -e"
  if (trailing) {
    article = trailing[2]!.toLowerCase()
    german = trailing[1]!.trim()
    plural = trailing[3]?.trim() ?? null
  }
  const leading = ARTICLE.exec(german)
  if (!article && leading && !/[.!?]$/.test(german)) {
    const [noun, ...rest] = leading[2]!.split(/\s*,\s*/)
    if (noun && noun.split(' ').length === 1) {
      article = leading[1]!.toLowerCase()
      german = noun
      plural = rest.join(', ') || null
    }
  }
  if (plural && /^-/.test(plural)) plural = null // "-e" style endings are not a full plural form

  const words = german.split(/\s+/).filter(Boolean).length
  const pos = article ? 'noun' : words > 5 || /[.!?]$/.test(german) ? 'sentence' : words > 1 ? 'phrase' : 'other'
  const maxLemma = pos === 'sentence' ? LIMITS.lemmaSentence : pos === 'phrase' ? LIMITS.lemmaPhrase : LIMITS.lemma
  const content = {
    version: CONTENT_VERSION,
    lemma: german.slice(0, maxLemma),
    pos,
    cefr: null,
    ipa: null,
    meanings: [{ translation: row.persian.slice(0, pos === 'sentence' ? LIMITS.translationSentence : LIMITS.shortText), note: null, examples: [] }],
    noun: article ? { article, gender: ARTICLES[target]?.[article] ?? null, plural, genitive: null, pluralOnly: false } : null,
    verb: null,
    adjective: null,
    synonyms: [],
    antonyms: [],
    collocations: [],
    notes: null,
  }
  const checked = validateWordContent(content, { mode: 'user', target, native })
  return checked.ok ? checked.value : null
}

const tsvField = (value: string) => value.replace(/[\t\r\n]+/g, ' ')

/** The Word Bank as an Anki-importable text file (tab separated, with header lines). */
export function exportDeck(words: readonly { content: WordContent; tags: readonly string[] }[]): string {
  const lines = ['#separator:tab', '#html:false', '#tags column:3']
  for (const w of words) {
    const c = w.content
    const front = c.noun?.article ? `${c.noun.article} ${c.lemma}` : c.lemma
    const back = c.meanings.map((m) => m.translation).join('؛ ')
    lines.push([front, back, w.tags.map((t) => t.replace(/\s+/g, '_')).join(' ')].map(tsvField).join('\t'))
  }
  return lines.join('\n') + '\n'
}
