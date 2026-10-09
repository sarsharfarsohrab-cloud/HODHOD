import { CEFR_VALUES, type Cefr, type PartOfSpeech } from '../../../supabase/functions/_shared/wordSchema.ts'
import { isDifficult, wordStatus, type WordStatus } from '../../core/cards.ts'
import { dayEnd } from '../../core/time.ts'
import type { Card, Word } from '../../core/types.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { foldGerman, foldPersian } from '../format.ts'
import { mascot } from '../mascot.ts'
import { t } from '../strings.ts'
import { cefrChip, emptyState, iconButton, openSheet, statusChip, wordTitle } from '../widgets.ts'

type Sort = 'newest' | 'alpha' | 'reviewed' | 'due'
type Quick = 'all' | WordStatus | 'favorites' | 'difficult' | 'due'

interface Filters {
  query: string
  quick: Quick
  pos: PartOfSpeech | null
  cefr: Cefr | null
  sort: Sort
}

const PAGE = 60
const SEARCH_DELAY_MS = 180
const FILTER_POS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']

/** Filters live outside the screen so coming back from a word keeps the list as it was. */
let saved: Filters = { query: '', quick: 'all', pos: null, cefr: null, sort: 'newest' }

interface Entry {
  word: Word
  card: Card | undefined
  status: WordStatus
  german: string
  persian: string
}

export function filterWords(entries: readonly Entry[], filters: Filters, now: Date): Entry[] {
  const german = foldGerman(filters.query)
  const persian = foldPersian(filters.query)
  const end = dayEnd(now).getTime()
  const out = entries.filter((e) => {
    if (filters.pos && e.word.pos !== filters.pos) return false
    if (filters.cefr && e.word.cefr !== filters.cefr) return false
    switch (filters.quick) {
      case 'all':
        break
      case 'favorites':
        if (!e.word.isFavorite) return false
        break
      case 'difficult':
        if (!isDifficult(e.card)) return false
        break
      case 'due':
        if (!e.card || e.card.state === 'new' || new Date(e.card.due).getTime() >= end) return false
        break
      default:
        if (e.status !== filters.quick) return false
    }
    if (!filters.query.trim()) return true
    return (german.length > 0 && e.german.includes(german)) || (persian.length > 0 && e.persian.includes(persian))
  })
  const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)
  switch (filters.sort) {
    case 'newest':
      return out.sort((a, b) => b.word.createdAt.localeCompare(a.word.createdAt))
    case 'alpha':
      return out.sort((a, b) => a.word.lemma.localeCompare(b.word.lemma, 'de', { sensitivity: 'base' }))
    case 'reviewed':
      return out.sort((a, b) => time(b.card?.lastReview) - time(a.card?.lastReview))
    case 'due':
      // cards being learned first by due date; words not started yet go last
      return out.sort((a, b) => (a.status === 'new' ? Infinity : time(a.card?.due)) - (b.status === 'new' ? Infinity : time(b.card?.due)))
  }
}

export function buildEntries(words: Iterable<Word>, cards: ReadonlyMap<string, Card>): Entry[] {
  const out: Entry[] = []
  for (const word of words) {
    const card = cards.get(word.id)
    out.push({
      word,
      card,
      status: wordStatus(card),
      german: foldGerman(`${word.lemma} ${word.content.noun?.plural ?? ''} ${word.content.verb?.partizip2 ?? ''}`),
      persian: foldPersian(word.content.meanings.map((m) => m.translation).join(' ')),
    })
  }
  return out
}

export function wordsScreen(ctx: Ctx): Screen {
  const filters = saved
  let limit = PAGE
  let selecting = false
  const selected = new Set<string>()
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  const el = h('main', { class: 'screen' })
  const search = h('input', {
    class: 'input', type: 'search', value: filters.query, placeholder: t.words.search, 'aria-label': t.words.search,
    autocapitalize: 'off', autocomplete: 'off', spellcheck: false, enterKeyHint: 'search',
    oninput: () => {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        filters.query = search.value
        limit = PAGE
        renderList()
      }, SEARCH_DELAY_MS)
    },
  })
  const header = h('header', { class: 'topbar' })
  const quickRow = h('div', { class: 'chips scroll', role: 'group', 'aria-label': t.words.statusGroup })
  const summary = h('div', { class: 'row spread small muted' })
  const list = h('div')
  const bulk = h('div')

  const quickOptions: { value: Quick; label: string }[] = [
    { value: 'all', label: t.words.all },
    { value: 'due', label: t.words.dueToday },
    { value: 'new', label: t.status.new },
    { value: 'learning', label: t.status.learning },
    { value: 'review', label: t.status.review },
    { value: 'mastered', label: t.status.mastered },
    { value: 'favorites', label: t.words.favorites },
    { value: 'difficult', label: t.words.difficult },
  ]

  const renderChrome = () => {
    replace(
      header,
      h('h1', null, selecting ? t.words.selected(selected.size) : t.words.title),
      ctx.data.words.size > 0
        ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => { selecting = !selecting; selected.clear(); renderChrome(); renderList() } }, selecting ? t.common.cancel : t.words.select)
        : null,
    )
    replace(
      quickRow,
      quickOptions.map((option) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filters.quick === option.value), onclick: () => { filters.quick = option.value; limit = PAGE; renderChrome(); renderList() } }, option.label),
      ),
    )
  }

  const openFilters = () => {
    openSheet(
      (close) => {
        const group = <T extends string>(title: string, options: { value: T | null; label: string; german?: boolean }[], current: T | null, set: (v: T | null) => void) =>
          h(
            'div',
            { class: 'stack' },
            h('span', { class: 'label' }, title),
            h(
              'div',
              { class: 'chips', role: 'group', 'aria-label': title },
              options.map((o) =>
                h('button', { class: `chip ${o.german ? 'cefr' : ''}`, type: 'button', 'aria-pressed': String(current === o.value), onclick: () => { set(o.value); limit = PAGE; close(); renderList(); openFilters() } }, o.label),
              ),
            ),
          )
        return [
          h('div', { class: 'row spread' }, h('h2', { style: { fontSize: 'var(--text-lg)' } }, t.words.filters), iconButton('close', t.common.close, close)),
          group<Sort>(t.words.sort, [
            { value: 'newest', label: t.words.sortNewest },
            { value: 'alpha', label: t.words.sortAlpha },
            { value: 'due', label: t.words.sortDue },
            { value: 'reviewed', label: t.words.sortReviewed },
          ], filters.sort, (v) => (filters.sort = v ?? 'newest')),
          group<PartOfSpeech>(t.words.posGroup, [{ value: null, label: t.words.all }, ...FILTER_POS.map((p) => ({ value: p, label: t.pos[p] }))], filters.pos, (v) => (filters.pos = v)),
          group<Cefr>(t.words.cefrGroup, [{ value: null, label: t.words.all }, ...CEFR_VALUES.map((c) => ({ value: c, label: c, german: true }))], filters.cefr, (v) => (filters.cefr = v)),
          h('button', { class: 'btn primary block', 'data-autofocus': '', onclick: close }, t.common.close),
        ]
      },
      { label: t.words.filters },
    )
  }

  const renderList = () => {
    const total = ctx.data.words.size
    if (total === 0) {
      replace(summary)
      replace(bulk)
      return replace(
        list,
        emptyState({
          art: mascot('happy', { size: 120 }),
          title: t.words.empty,
          body: t.words.emptyBody,
          action: h('a', { class: 'btn primary', href: '#/create' }, icon('plus'), t.home.addWord),
        }),
      )
    }
    const matches = filterWords(buildEntries(ctx.data.words.values(), ctx.data.cards), filters, ctx.now())
    const active = (filters.pos ? 1 : 0) + (filters.cefr ? 1 : 0) + (filters.sort !== 'newest' ? 1 : 0)
    replace(
      summary,
      h('span', { 'aria-live': 'polite' }, t.words.count(matches.length, total)),
      h('button', { class: 'btn small ghost', type: 'button', onclick: openFilters }, icon('filter', { size: 18 }), active ? `${t.words.filters} (${active.toLocaleString('fa-IR')})` : t.words.filters),
    )
    if (matches.length === 0) {
      replace(bulk)
      return replace(
        list,
        emptyState({
          title: t.words.noMatch,
          action: h('button', { class: 'btn', type: 'button', onclick: () => { Object.assign(filters, { query: '', quick: 'all', pos: null, cefr: null }); search.value = ''; renderChrome(); renderList() } }, t.words.clearFilters),
        }),
      )
    }
    const shown = matches.slice(0, limit)
    replace(
      list,
      h(
        'ul',
        { class: 'word-list' },
        shown.map(({ word, status }) => {
          const star = iconButton('star', t.draft.fields.favorite, () => void ctx.data.setFavorite(word.id, !word.isFavorite), `compact ${word.isFavorite ? 'on' : ''}`)
          star.setAttribute('aria-pressed', String(word.isFavorite))
          if (word.isFavorite) star.replaceChildren(icon('star', { filled: true, size: 20 }))
          const check = selecting
            ? h('input', { class: 'check', type: 'checkbox', checked: selected.has(word.id), 'aria-label': word.lemma, onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? selected.add(word.id) : selected.delete(word.id); renderChrome(); renderBulk() } })
            : null
          return h(
            'li',
            { class: 'word-row' },
            check,
            h('a', { href: `#/words/${word.id}` }, wordTitle(word.content, 'span', 'de'), h('span', { class: 'meaning-line' }, word.primaryMeaning)),
            h('div', { class: 'meta' }, statusChip(status), cefrChip(word.cefr)),
            selecting ? null : star,
          )
        }),
      ),
      matches.length > shown.length ? h('div', { class: 'load-more', style: { display: 'grid', padding: 'var(--s4) 0' } }, h('button', { class: 'btn', type: 'button', onclick: () => { limit += PAGE; renderList() } }, t.words.showMore)) : null,
    )
    // long lists grow as the learner scrolls; the button stays as a fallback
    const more = list.querySelector('.load-more')
    if (more && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          limit += PAGE
          renderList()
        }
      }, { rootMargin: '400px' })
      observer.observe(more)
    }
    renderBulk()
  }

  const renderBulk = () => {
    if (!selecting || selected.size === 0) return replace(bulk)
    const ids = [...selected]
    replace(
      bulk,
      h(
        'div',
        { class: 'sticky-actions' },
        h('button', { class: 'btn grow', type: 'button', onclick: async () => { for (const id of ids) await ctx.data.setFavorite(id, true); selecting = false; selected.clear(); renderChrome(); renderList() } }, icon('star', { size: 18 }), t.words.favoriteSelected),
        h(
          'button',
          {
            class: 'btn danger grow',
            type: 'button',
            onclick: async () => {
              if (!(await ctx.confirm({ title: t.words.archiveConfirm(ids.length), confirmLabel: t.words.archiveSelected, danger: true }))) return
              await ctx.data.archiveWords(ids)
              selecting = false
              selected.clear()
              renderChrome()
              renderList()
            },
          },
          icon('trash', { size: 18 }),
          t.words.archiveSelected,
        ),
      ),
    )
  }

  el.append(header, h('div', { class: 'search' }, icon('search', { size: 20 }), search), quickRow, summary, list, bulk)
  renderChrome()
  renderList()
  return {
    el,
    onData: renderList,
    destroy() {
      clearTimeout(searchTimer)
      saved = filters
    },
  }
}
