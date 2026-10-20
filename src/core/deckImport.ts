/**
 * Reading flashcard files exported from Anki ("Notes in Plain Text", .txt/.tsv) or Quizlet
 * (copied/exported text, tab or comma separated), and writing the Word Bank back out in a
 * format Anki can import. Pure functions: no network, no DOM.
 */
import { LIMITS, validateWordContent, type WordContent } from '../../supabase/functions/_shared/wordSchema.ts'

export interface DeckRow {
  german: string
  persian: string
  tags: string[]
}

export interface ParsedDeck {
  rows: DeckRow[]
  /** Lines that did not contain a German and a Persian side. */
  skipped: number
  separator: '\t' | ';' | ','
}

const PERSIAN = /[؀-ۿ]/
const LATIN = /\p{Script=Latin}/u
const ARTICLE = /^(der|die|das)\s+(\S.*)$/i

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

export function parseDeck(text: string): ParsedDeck {
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
    // German on one side, Persian on the other, in either order
    const german = values.find((v) => LATIN.test(v) && !PERSIAN.test(v))
    const persian = values.find((v) => PERSIAN.test(v))
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
export function contentFromRow(row: DeckRow): WordContent | null {
  let german = row.german.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  let article: 'der' | 'die' | 'das' | null = null
  let plural: string | null = null

  const trailing = /^([^,]+),\s*(der|die|das)\b(?:,\s*(.+))?$/i.exec(german) // "Tisch, der, -e"
  if (trailing) {
    article = trailing[2]!.toLowerCase() as 'der'
    german = trailing[1]!.trim()
    plural = trailing[3]?.trim() ?? null
  }
  const leading = ARTICLE.exec(german)
  if (!article && leading && !/[.!?]$/.test(german)) {
    const [noun, ...rest] = leading[2]!.split(/\s*,\s*/)
    if (noun && noun.split(' ').length === 1) {
      article = leading[1]!.toLowerCase() as 'der'
      german = noun
      plural = rest.join(', ') || null
    }
  }
  if (plural && /^-/.test(plural)) plural = null // "-e" style endings are not a full plural form

  const words = german.split(/\s+/).filter(Boolean).length
  const pos = article ? 'noun' : words > 5 || /[.!?]$/.test(german) ? 'sentence' : words > 1 ? 'phrase' : 'other'
  const maxLemma = pos === 'sentence' ? LIMITS.lemmaSentence : pos === 'phrase' ? LIMITS.lemmaPhrase : LIMITS.lemma
  const content = {
    version: 2,
    lemma: german.slice(0, maxLemma),
    pos,
    cefr: null,
    ipa: null,
    meanings: [{ translation: row.persian.slice(0, pos === 'sentence' ? LIMITS.translationSentence : LIMITS.shortText), note: null, examples: [] }],
    noun: article ? { article, plural, genitive: null, pluralOnly: false } : null,
    verb: null,
    adjective: null,
    synonyms: [],
    antonyms: [],
    collocations: [],
    notes: null,
  }
  const checked = validateWordContent(content, { mode: 'user' })
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
