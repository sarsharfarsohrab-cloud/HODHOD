/** The pack store: free ready-made packs, each a short path of lessons. */
import { packProgress, type LessonProgress, type PackProgress } from '../../core/packs.ts'
import type { Word } from '../../core/types.ts'
import { toAppError } from '../../data/errors.ts'
import { packItems, startPackLesson, storePacks, type PackItem, type StorePack } from '../../data/platform.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { fa } from '../format.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { emptyState, progressBar, segmented } from '../widgets.ts'

type KindFilter = 'all' | StorePack['kind']

const backTo = (ctx: Ctx, to: string) =>
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go(to) }, icon('back'))

/** Learned / total for a pack, from the learner's own words (no server call). */
function ownedProgress(ctx: Ctx, pack: StorePack): { green: number; inBank: number } {
  let green = 0
  let inBank = 0
  const cards = new Map<string, string>()
  for (const c of ctx.data.activeCards()) if (c.cardType === 'recognition') cards.set(c.wordId, c.state)
  for (const word of ctx.data.words.values()) {
    if (word.packId !== pack.id || word.deletedAt) continue
    inBank++
    if (cards.get(word.id) === 'review') green++
  }
  return { green, inBank }
}

function packCard(ctx: Ctx, pack: StorePack): HTMLElement {
  const s = t.store
  const progress = pack.owned ? ownedProgress(ctx, pack) : null
  return h(
    'a',
    { class: `pack-card ${pack.owned ? 'owned' : ''}`, href: `#/store/${pack.id}` },
    h('span', { class: 'pack-emoji', 'aria-hidden': 'true' }, pack.emoji || '📦'),
    h(
      'span',
      { class: 'pack-text' },
      h('b', null, pack.title),
      h(
        'span',
        { class: 'pack-meta' },
        h('span', { class: 'chip' }, s.kinds[pack.kind]),
        pack.level ? h('span', { class: `chip level-${pack.level}` }, s.levels[pack.level]) : null,
        !pack.published ? h('span', { class: 'chip warn' }, t.admin.unpublished) : null,
        h('span', { class: 'small muted' }, s.size(pack.items, pack.lessons)),
      ),
      pack.description && !progress ? h('span', { class: 'pack-desc' }, pack.description) : null,
      progress ? progressBar(pack.items ? progress.green / pack.items : 0, s.progress(progress.green, pack.items)) : null,
      progress ? h('span', { class: 'small muted' }, s.progress(progress.green, pack.items)) : null,
    ),
  )
}

export function storeScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen wide store' })
  const s = t.store
  let packs: StorePack[] | null = null
  let failed: string | null = null
  let filter: KindFilter = 'all'

  const render = () => {
    const header = h('header', { class: 'topbar' }, backTo(ctx, '/home'), h('h1', null, s.title))
    if (failed) {
      return replace(el, header, emptyState({ art: mascot('confused', { size: 120 }), title: failed, action: h('button', { class: 'btn', type: 'button', onclick: load }, icon('refresh'), t.common.retry) }))
    }
    if (!packs) return replace(el, header, h('p', { class: 'muted center' }, t.common.loading))
    const visible = packs.filter((p) => p.items > 0 || !p.published)
    if (visible.length === 0) return replace(el, header, emptyState({ art: mascot('waiting', { size: 120 }), title: s.empty }))
    const kinds = [...new Set(visible.map((p) => p.kind))]
    const mine = visible.filter((p) => p.owned)
    const shown = visible.filter((p) => !p.owned && (filter === 'all' || p.kind === filter))
    replace(
      el,
      header,
      h('section', { class: 'store-hero' }, mascot('pointing', { size: 96 }), h('p', null, s.intro)),
      mine.length > 0 ? h('section', { class: 'stack' }, h('h2', null, s.mine), h('div', { class: 'pack-grid' }, mine.map((p) => packCard(ctx, p)))) : null,
      kinds.length > 1
        ? segmented<KindFilter>([{ value: 'all', label: s.all }, ...kinds.map((k) => ({ value: k as KindFilter, label: s.kinds[k] }))], filter, (v) => { filter = v; render() }, s.title)
        : null,
      shown.length > 0 ? h('div', { class: 'pack-grid' }, shown.map((p) => packCard(ctx, p))) : h('p', { class: 'muted' }, s.emptyFilter),
    )
  }

  async function load() {
    failed = null
    packs = null
    render()
    try {
      packs = await storePacks(ctx.client)
    } catch (err) {
      const error = toAppError(err)
      failed = error.kind === 'not_found' ? s.unavailable : describeError(error)
    }
    render()
  }

  void load()
  return { el, onData: render }
}

// --- one pack -----------------------------------------------------------------------

export function packScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const id = params.id ?? ''
  const el = h('main', { class: 'screen pack-page' })
  const s = t.store
  let pack: StorePack | null = null
  let items: PackItem[] = []
  let failed: string | null = null
  let loading = true
  let busy = false
  let openLesson: number | null = null

  const wordOf = (entry: { id: string; lemma: string | null; pos: string | null }): Word | undefined => {
    for (const w of ctx.data.words.values()) if (w.packItemId === entry.id && !w.deletedAt) return w
    return entry.lemma ? ctx.data.findDuplicate(entry.lemma, (entry.pos ?? undefined) as Word['pos'] | undefined) : undefined
  }

  const progress = (): PackProgress => {
    const byWord = new Map<string, ReturnType<typeof ctx.data.activeCards>>()
    for (const c of ctx.data.activeCards()) {
      const list = byWord.get(c.wordId) ?? []
      list.push(c)
      byWord.set(c.wordId, list)
    }
    return packProgress(items, wordOf, (wordId) => byWord.get(wordId) ?? [])
  }

  async function start(lesson: number) {
    if (!pack || busy) return
    busy = true
    render()
    try {
      const added = await startPackLesson(ctx.client, pack.id, lesson)
      await ctx.data.syncNow()
      ctx.toast(added > 0 ? s.started(added) : s.startedNone)
      pack.owned = true
      if (added > 0) ctx.go(`/study?pack=${pack.id}`)
    } catch (err) {
      ctx.toast(describeError(toAppError(err)), 'error')
    } finally {
      busy = false
      render()
    }
  }

  const lessonRow = (l: LessonProgress, suggested: boolean, firstLocked: boolean) => {
    const state = l.state
    const node =
      state === 'done' ? icon('check', { size: 22 }) : state === 'locked' ? icon('lock', { size: 20 }) : h('b', null, fa(l.lesson))
    const label = { done: s.lessonDone, active: s.lessonActive, open: s.lessonOpen, locked: s.lessonLocked }[state]
    const expanded = openLesson === l.lesson
    const missing = l.inBank < l.entries.length
    const canStart = (state === 'open' || (state === 'active' && missing)) && pack?.published !== false
    return h(
      'li',
      { class: `lesson ${state} ${suggested ? 'suggested' : ''}` },
      h('span', { class: 'lesson-node', 'aria-hidden': 'true' }, node),
      h(
        'div',
        { class: 'lesson-body' },
        h(
          'button',
          { class: 'lesson-head', type: 'button', 'aria-expanded': String(expanded), onclick: () => { openLesson = expanded ? null : l.lesson; render() } },
          h('span', null, h('b', null, s.lesson(l.lesson)), h('span', { class: 'small muted' }, `، ${s.lessonWords(l.entries.length)}`)),
          h('span', { class: `lesson-state small` }, state === 'active' ? s.lessonProgress(l.green, l.entries.length) : label),
        ),
        state === 'active' || state === 'done' ? progressBar(l.green / l.entries.length, s.lessonProgress(l.green, l.entries.length)) : null,
        firstLocked ? h('p', { class: 'help' }, s.lockedHint) : null,
        expanded
          ? h(
              'ul',
              { class: 'lesson-preview' },
              l.entries.map((e) => {
                const item = items.find((i) => i.id === e.id)
                const known = wordOf(e)
                return h(
                  'li',
                  { class: known ? 'known' : '' },
                  h('span', { class: 'de', lang: 'de', dir: 'ltr' }, de(item?.lemma ?? item?.input ?? '')),
                  h('span', { class: 'muted' }, item?.primary_meaning ?? ''),
                )
              }),
            )
          : null,
        canStart
          ? h('button', { class: `btn ${suggested ? 'primary' : ''} block`, type: 'button', disabled: busy, onclick: () => void start(l.lesson) }, icon('play', { size: 18 }), busy ? s.starting : s.start(l.lesson))
          : null,
      ),
    )
  }

  function render() {
    const header = h('header', { class: 'topbar' }, backTo(ctx, '/store'))
    if (loading) return replace(el, header, h('p', { class: 'muted center' }, t.common.loading))
    if (failed || !pack) {
      return replace(el, header, emptyState({ art: mascot('confused', { size: 120 }), title: failed ?? s.notFound, action: h('a', { class: 'btn', href: '#/store' }, s.title) }))
    }
    const p = progress()
    const inBank = p.lessons.reduce((n, l) => n + l.inBank, 0)
    replace(
      el,
      header,
      h(
        'section',
        { class: 'pack-hero' },
        h('span', { class: 'pack-emoji big', 'aria-hidden': 'true' }, pack.emoji || '📦'),
        h('h1', null, pack.title),
        h(
          'div',
          { class: 'chips' },
          h('span', { class: 'chip' }, s.kinds[pack.kind]),
          pack.level ? h('span', { class: `chip level-${pack.level}` }, s.levels[pack.level]) : null,
          h('span', { class: 'chip' }, s.size(p.total, p.lessons.length)),
        ),
        pack.description ? h('p', { class: 'muted' }, pack.description) : null,
        inBank > 0
          ? h(
              'div',
              { class: 'stack', style: { gap: 'var(--s2)', width: '100%' } },
              progressBar(p.total ? p.green / p.total : 0, s.progress(p.green, p.total)),
              h('span', { class: 'small' }, s.progress(p.green, p.total)),
              h('a', { class: 'btn block', href: `#/study?pack=${pack.id}` }, icon('cards'), s.studyPack),
              h('span', { class: 'help' }, s.studyPackHint),
            )
          : null,
      ),
      h(
        'ol',
        { class: 'lesson-path' },
        p.lessons.map((l) => lessonRow(l, l.lesson === p.current, l === p.lessons.find((x) => x.state === 'locked'))),
      ),
    )
  }

  async function load() {
    loading = true
    render()
    try {
      const [all, list] = await Promise.all([storePacks(ctx.client), packItems(ctx.client, id)])
      pack = all.find((x) => x.id === id) ?? null
      items = list
    } catch (err) {
      failed = describeError(toAppError(err))
    }
    loading = false
    render()
  }

  void load()
  return { el, onData: () => !loading && render() }
}
