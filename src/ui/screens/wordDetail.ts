import { wordStatus } from '../../core/cards.ts'
import { toSchedulingState } from '../../core/cards.ts'
import { toAppError } from '../../data/errors.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { createEditor } from '../editor.ts'
import { fa, faDate, faDuration, faPercent, faRelative } from '../format.ts'
import { describeError, t } from '../strings.ts'
import { emptyState, iconButton, statusChip, tagEditor } from '../widgets.ts'
import { conjugationCard, grammarCard, meaningsCard, relatedCards, wordHeader } from '../wordView.ts'

/** Position of a card in the single-column (phone) reading order. */
function order<T extends HTMLElement | null>(position: number, el: T): T {
  if (el) el.style.order = String(position)
  return el
}

const backButton = (ctx: Ctx, to: string) =>
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go(to) }, icon('back'))

export function wordDetailScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const el = h('main', { class: 'screen wide' })
  const id = params.id ?? ''

  const render = () => {
    const word = ctx.data.words.get(id)
    if (!word) {
      return replace(
        el,
        h('header', { class: 'topbar' }, backButton(ctx, '/words'), h('h1', null, t.words.title)),
        emptyState({ title: t.detail.notFound, action: h('a', { class: 'btn', href: '#/words' }, t.words.title) }),
      )
    }
    const card = ctx.data.cards.get(id)
    const status = wordStatus(card)
    const now = ctx.now()
    const d = t.detail

    const favorite = iconButton('star', t.draft.fields.favorite, async () => {
      await ctx.data.setFavorite(id, !word.isFavorite)
      ctx.toast(word.isFavorite ? d.favoriteOff : d.favoriteOn)
    }, word.isFavorite ? 'on' : '')
    favorite.setAttribute('aria-pressed', String(word.isFavorite))
    if (word.isFavorite) favorite.replaceChildren(icon('star', { filled: true }))

    let learning: HTMLElement
    if (!card || card.state === 'new') {
      learning = h('section', { class: 'card stack' }, h('div', { class: 'row spread' }, h('h2', null, d.learning), statusChip(status)), h('p', { class: 'muted' }, d.notStarted))
    } else {
      const recall = ctx.scheduler().retrievability(toSchedulingState(card), now)
      const difficultyWord = d.difficultyWords[Math.min(4, Math.max(0, Math.floor((card.difficulty - 1) / 1.8)))]!
      learning = h(
        'section',
        { class: 'card stack' },
        h('div', { class: 'row spread' }, h('h2', null, d.learning), statusChip(status)),
        h(
          'dl',
          { class: 'facts' },
          h('dt', null, d.nextReview), h('dd', null, new Date(card.due) <= now ? d.overdue(faRelative(card.due, now)) : faRelative(card.due, now)),
          h('dt', null, d.lastReview), h('dd', null, card.lastReview ? faRelative(card.lastReview, now) : d.never),
          h('dt', null, d.reviewCount), h('dd', null, fa(card.reps)),
          h('dt', null, d.lapses), h('dd', null, fa(card.lapses)),
          recall !== null ? h('dt', null, d.recall) : null, recall !== null ? h('dd', null, faPercent(recall)) : null,
          h('dt', null, d.stability), h('dd', null, faDuration(card.stability * 86_400_000)),
          h('dt', null, d.difficulty), h('dd', null, difficultyWord),
        ),
      )
    }

    // The reverse card has its own schedule; show it while reverse cards are in use.
    const reverse = ctx.data.settings.reverseCards ? ctx.data.reverseCards.get(id) : undefined
    if (reverse) {
      learning.append(
        h('div', { class: 'row spread', style: { borderTop: '1px solid var(--line)', paddingTop: 'var(--s3)' } }, h('span', { class: 'label' }, d.reverseCard), statusChip(wordStatus(reverse))),
        h('p', { class: 'small muted' }, reverse.state === 'new' ? d.reverseWaiting : `${d.nextReview}: ${new Date(reverse.due) <= now ? d.overdue(faRelative(reverse.due, now)) : faRelative(reverse.due, now)}`),
      )
    }

    replace(
      el,
      h('header', { class: 'topbar' }, backButton(ctx, '/words'), h('div', { class: 'grow' }), iconButton('edit', t.common.edit, () => ctx.go(`/words/${id}/edit`))),
      wordHeader(ctx, word.content, [favorite]),
      // One column on phones (in reading order); two columns on wide screens.
      h(
        'div',
        { class: 'cols' },
        h('div', { class: 'col' }, order(1, meaningsCard(ctx, word.content)), ...relatedCards(word.content).map((card) => order(4, card))),
        h(
          'div',
          { class: 'col' },
          order(2, grammarCard(ctx, word.content)),
          order(3, conjugationCard(ctx, word.content)),
          order(5, learning),
          order(5, h('section', { class: 'card stack' }, h('h2', null, t.tags.title), tagEditor(ctx, word.tags, (tags) => void ctx.data.setTags(id, tags), { emptyText: t.tags.none }))),
          order(
            6,
      h(
              'section',
              { class: 'card stack' },
              h('p', { class: 'small muted' }, `${d.addedOn} ${faDate(word.createdAt)}`),
              h('a', { class: 'btn block', href: `#/words/${id}/edit` }, icon('edit', { size: 18 }), t.common.edit),
              h(
                'button',
                {
                  class: 'btn block',
                  type: 'button',
                  onclick: async () => {
                    if (await ctx.confirm({ title: d.regenerate, body: d.regenerateConfirm, confirmLabel: d.regenerate })) ctx.go(`/create?regenerate=${id}`)
                  },
                },
                icon('sparkle', { size: 18 }),
                d.regenerate,
              ),
              h(
                'button',
                {
                  class: 'btn danger block',
                  type: 'button',
                  onclick: async () => {
                    if (!(await ctx.confirm({ title: d.archive, body: d.archiveConfirm, confirmLabel: t.common.delete, danger: true }))) return
                    await ctx.data.archiveWords([id])
                    ctx.toast(d.archived)
                    ctx.go('/words', { replace: true })
                  },
                },
                icon('trash', { size: 18 }),
                d.archive,
              ),
            ),
          ),
        ),
      ),
    )
  }

  render()
  return { el, onData: render }
}

/** Editing a saved word: the same form as for a draft, saved back with a conflict check. */
export function wordEditScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const id = params.id ?? ''
  const word = ctx.data.words.get(id)
  const el = h('main', { class: 'screen' })
  if (!word) {
    el.append(emptyState({ title: t.detail.notFound, action: h('a', { class: 'btn', href: '#/words' }, t.words.title) }))
    return { el }
  }
  const editor = createEditor(word.content)
  let saved = false
  const save = h('button', { class: 'btn primary big grow', type: 'button' }, icon('check'), t.draft.saveChanges)
  save.onclick = async () => {
    const result = editor.read()
    if (!result.ok) return
    save.disabled = true
    try {
      await ctx.data.updateWordContent(id, result.value)
      saved = true
      ctx.toast(t.draft.updated)
      ctx.go(`/words/${id}`, { replace: true })
    } catch (err) {
      const error = toAppError(err)
      ctx.toast(error.kind === 'conflict' ? t.draft.conflict : describeError(error), 'error')
      if (error.kind === 'conflict') {
        saved = true // the form is based on an outdated version; reopen it on the newer one
        ctx.go(`/words/${id}`, { replace: true })
      }
    } finally {
      save.disabled = false
    }
  }
  el.append(
    h('header', { class: 'topbar' }, backButton(ctx, `/words/${id}`), h('h1', null, t.common.edit)),
    editor.el,
    h('div', { class: 'sticky-actions' }, h('a', { class: 'btn big', href: `#/words/${id}` }, t.common.cancel), save),
  )
  return {
    el,
    canLeave: () => saved || !editor.dirty() || ctx.confirm({ title: t.draft.discardConfirm, confirmLabel: t.draft.discard, danger: true }),
  }
}
