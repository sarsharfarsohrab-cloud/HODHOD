/**
 * Bringing cards over from Anki or Quizlet: pick the exported text file (or paste it),
 * see what was understood, then either import the cards as they are (free, instant) or
 * hand the German side to the AI list import for complete cards.
 */
import { contentFromRow, parseDeck, type ParsedDeck } from '../../core/deckImport.ts'
import type { WordContent } from '../../../supabase/functions/_shared/wordSchema.ts'
import { toAppError } from '../../data/errors.ts'
import { wordColumns } from '../../data/mappers.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { fa } from '../format.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { tagEditor } from '../widgets.ts'
import { MAX_IMPORT, prefillImport } from './import.ts'

const CHUNK = 500
const MAX_ROWS = 5_000

interface Prepared {
  deck: ParsedDeck
  fresh: { content: WordContent; tags: string[] }[]
  existing: number
  invalid: number
}

export function deckImportScreen(ctx: Ctx): Screen {
  const d = t.deck
  const el = h('main', { class: 'screen' })
  let prepared: Prepared | null = null
  let tags: string[] = ['Anki']
  let busy = false

  const header = () => h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, onclick: () => ctx.go(prepared ? '/import/deck' : '/import') }, icon('back')), h('h1', null, d.title))

  function prepare(text: string) {
    const deck = parseDeck(text)
    deck.rows = deck.rows.slice(0, MAX_ROWS)
    const seen = new Set<string>()
    const fresh: Prepared['fresh'] = []
    let existing = 0
    let invalid = 0
    for (const row of deck.rows) {
      const content = contentFromRow(row)
      if (!content) {
        invalid++
        continue
      }
      const key = `${content.lemma}|${content.pos}`
      if (seen.has(key) || ctx.data.findDuplicate(content.lemma, content.pos)) {
        existing++
        continue
      }
      seen.add(key)
      fresh.push({ content, tags: row.tags })
    }
    prepared = { deck, fresh, existing, invalid }
    render()
  }

  async function importAll(button: HTMLButtonElement) {
    if (!prepared || busy) return
    busy = true
    button.disabled = true
    let added = 0
    try {
      const rows = prepared.fresh.map(({ content, tags: own }) => ({
        ...wordColumns(content),
        target_language: ctx.data.profile.activeTargetLanguage,
        native_language: ctx.data.profile.nativeLanguage,
        tags: [...new Set([...tags, ...own])].slice(0, 20),
      }))
      for (let i = 0; i < rows.length; i += CHUNK) {
        added += Number(await ctx.client.rpc<number>('import_words', { p_words: rows.slice(i, i + CHUNK) })) || 0
        button.textContent = d.importing(Math.min(i + CHUNK, rows.length), rows.length)
      }
      await ctx.data.syncNow()
      ctx.toast(d.imported(added))
      ctx.go('/words', { replace: true })
    } catch (err) {
      ctx.toast(describeError(toAppError(err)), 'error')
      button.disabled = false
    } finally {
      busy = false
    }
  }

  function withAi() {
    if (!prepared) return
    const list = prepared.fresh.slice(0, MAX_IMPORT).map((f) => (f.content.noun?.article ? `${f.content.noun.article} ${f.content.lemma}` : f.content.lemma))
    prefillImport(ctx.data, list.join('\n'), tags)
    if (prepared.fresh.length > MAX_IMPORT) ctx.toast(t.import.tooMany(MAX_IMPORT))
    ctx.go('/import')
  }

  function renderPick() {
    const file = h('input', { type: 'file', accept: '.txt,.tsv,.csv,text/plain,text/csv,text/tab-separated-values', class: 'visually-hidden', id: 'deck-file' })
    file.onchange = async () => {
      const chosen = file.files?.[0]
      if (!chosen) return
      prepare(await chosen.text())
    }
    const area = h('textarea', { class: 'textarea', rows: 6, dir: 'auto', placeholder: 'der Tisch\tمیز\naufgeben\tدست کشیدن', 'aria-label': d.paste })
    replace(
      el,
      header(),
      h(
        'section',
        { class: 'card stack' },
        h('div', { class: 'row' }, mascot('reading', { size: 72 }), h('p', { class: 'grow' }, d.intro)),
        h('label', { class: 'btn primary big block', for: 'deck-file' }, icon('download', { size: 20 }), d.pickFile),
        file,
        h('details', { class: 'fold small' }, h('summary', { class: 'muted' }, d.howTitle, icon('chevron', { size: 18 })), h('ul', { class: 'how-list' }, d.how.map((line) => h('li', null, line)))),
      ),
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, d.paste),
        area,
        h('button', { class: 'btn block', type: 'button', onclick: () => area.value.trim() && prepare(area.value) }, d.read),
      ),
    )
  }

  function renderPreview(p: Prepared) {
    const quick = h('button', { class: 'btn primary big block', type: 'button', disabled: p.fresh.length === 0 }, icon('check'), d.importQuick(p.fresh.length))
    quick.onclick = () => void importAll(quick)
    replace(
      el,
      header(),
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, d.found(p.deck.rows.length)),
        h(
          'ul',
          { class: 'deck-counts' },
          h('li', null, h('b', null, fa(p.fresh.length)), d.countNew),
          p.existing ? h('li', null, h('b', null, fa(p.existing)), d.countExisting) : null,
          p.invalid + p.deck.skipped ? h('li', null, h('b', null, fa(p.invalid + p.deck.skipped)), d.countSkipped) : null,
        ),
        p.fresh.length > 0
          ? h(
              'ul',
              { class: 'deck-preview' },
              p.fresh.slice(0, 8).map((f) => h('li', null, de(f.content.noun?.article ? `${f.content.noun.article} ${f.content.lemma}` : f.content.lemma), h('span', { class: 'muted' }, f.content.meanings[0]!.translation))),
              p.fresh.length > 8 ? h('li', { class: 'muted small' }, d.andMore(p.fresh.length - 8)) : null,
            )
          : h('p', { class: 'muted' }, d.nothingNew),
        h('div', { class: 'stack' }, h('span', { class: 'label' }, t.import.tagLabel), tagEditor(ctx, tags, (next) => (tags = next))),
      ),
      p.fresh.length > 0
        ? h(
            'section',
            { class: 'card stack' },
            quick,
            h('p', { class: 'help' }, d.quickHelp),
            h('button', { class: 'btn block', type: 'button', onclick: withAi }, icon('sparkle', { size: 18 }), d.withAi(Math.min(p.fresh.length, MAX_IMPORT))),
            h('p', { class: 'help' }, d.aiHelp(MAX_IMPORT)),
          )
        : null,
      h('button', { class: 'btn ghost block', type: 'button', onclick: () => { prepared = null; render() } }, d.other),
    )
  }

  function render() {
    if (prepared) renderPreview(prepared)
    else renderPick()
  }

  render()
  return { el }
}
