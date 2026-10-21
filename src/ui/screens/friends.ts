/**
 * Learning with friends: share a code, add each other, and see a small weekly board.
 * Friends see only a name, the streak, this week's answers and the number of learned
 * words — never the words themselves.
 */
import { localTimeZone } from '../../core/time.ts'
import { toAppError } from '../../data/errors.ts'
import { friends, type FriendRequestResult, type FriendRow } from '../../data/platform.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { fa } from '../format.ts'
import { burst, mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'

const MEDALS = ['🥇', '🥈', '🥉']

export function friendsScreen(ctx: Ctx): Screen {
  const f = t.friends
  const el = h('main', { class: 'screen friends' })
  let code: string | null = null
  let rows: FriendRow[] | null = null
  let failed: string | null = null

  const header = () =>
    h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, onclick: () => ctx.go('/home') }, icon('back')), h('h1', null, f.title))

  async function load() {
    try {
      const [mine, board] = await Promise.all([friends.myCode(ctx.client, ctx.data.userId), friends.board(ctx.client, ctx.data.settings.timeZone ?? localTimeZone())])
      code = mine
      rows = board
      failed = null
    } catch (err) {
      const error = toAppError(err)
      failed = error.kind === 'not_found' ? f.unavailable : describeError(error)
    }
    render()
  }

  async function share() {
    if (!code) return
    const text = f.shareText(code, location.href.split('#')[0]!)
    if (navigator.share) {
      await navigator.share({ text }).catch(() => undefined)
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      ctx.toast(f.copied)
    } catch {
      ctx.toast(code)
    }
  }

  async function add(input: HTMLInputElement, button: HTMLButtonElement) {
    const value = input.value.trim()
    if (!/^[A-Za-z2-9\s-]{8,10}$/.test(value)) return ctx.toast(f.badCode, 'error')
    button.disabled = true
    try {
      const result: FriendRequestResult = await friends.request(ctx.client, value)
      ctx.toast(f.results[result], result === 'sent' || result === 'accepted' ? 'info' : 'error')
      if (result === 'sent' || result === 'accepted') {
        input.value = ''
        void load()
      }
    } catch (err) {
      ctx.toast(describeError(toAppError(err)), 'error')
    } finally {
      button.disabled = false
    }
  }

  function boardRow(row: FriendRow, rank: number) {
    const remove = row.is_me || !row.friendship_id
      ? null
      : h('button', {
          class: 'icon-btn compact',
          type: 'button',
          'aria-label': f.remove,
          title: f.remove,
          onclick: async () => {
            if (!(await ctx.confirm({ title: f.remove, body: f.removeConfirm(row.display_name ?? '—'), confirmLabel: f.remove, danger: true }))) return
            await friends.remove(ctx.client, row.friendship_id!).catch(() => undefined)
            void load()
          },
        }, icon('close', { size: 16 }))
    return h(
      'li',
      { class: `board-row ${row.is_me ? 'me' : ''}` },
      h('span', { class: 'board-rank', 'aria-label': f.rank(rank + 1) }, MEDALS[rank] && row.week_reviews > 0 ? MEDALS[rank] : fa(rank + 1)),
      h('span', { class: 'board-name' }, h('b', null, row.is_me ? f.me : row.display_name || f.noName), h('small', { class: 'muted' }, f.learned(row.learned))),
      h('span', { class: `board-streak ${row.streak > 0 ? 'hot' : ''}`, title: f.streak }, h('b', null, icon('flame', { size: 16, filled: row.streak > 0 }), fa(row.streak)), h('small', null, f.days)),
      h('span', { class: 'board-week' }, h('b', null, fa(row.week_reviews)), h('small', null, f.answers)),
      remove,
    )
  }

  function render() {
    if (failed) return replace(el, header(), h('p', { class: 'notice error' }, failed))
    if (!rows) return replace(el, header(), h('p', { class: 'muted center' }, t.common.loading))
    const accepted = rows.filter((r) => r.status === 'accepted').sort((a, b) => b.week_reviews - a.week_reviews || b.streak - a.streak)
    const incoming = rows.filter((r) => r.incoming)
    const outgoing = rows.filter((r) => r.status === 'pending' && !r.incoming)
    const input = h('input', { class: 'input code-input', type: 'text', maxLength: 10, placeholder: 'ABCD2345', autocapitalize: 'characters', autocomplete: 'off', spellcheck: false, dir: 'ltr', 'aria-label': f.addLabel })
    const addButton = h('button', { class: 'btn primary', type: 'submit' }, icon('plus', { size: 18 }), f.add)
    const art = mascot(accepted.length > 1 ? 'celebrating' : 'pointing', { size: 96, enter: 'hop' })
    replace(
      el,
      header(),
      h(
        'section',
        { class: 'friends-hero' },
        h('button', { class: 'mascot-button', type: 'button', 'aria-label': 'هدهد', onclick: () => burst(art, 'hearts', 7) }, art),
        h(
          'div',
          { class: 'stack', style: { gap: 'var(--s2)' } },
          h('span', { class: 'small' }, f.myCode),
          h('b', { class: 'friend-code', dir: 'ltr' }, code ?? '—'),
          h('button', { class: 'btn small on-dark', type: 'button', onclick: () => void share(), disabled: !code }, icon('share', { size: 16 }), f.share),
        ),
      ),
      h(
        'form',
        { class: 'card stack', onsubmit: (e: Event) => { e.preventDefault(); void add(input, addButton) } },
        h('h2', null, f.addTitle),
        h('div', { class: 'row' }, h('div', { class: 'grow' }, input), addButton),
        h('p', { class: 'help' }, f.privacy),
      ),
      incoming.length > 0
        ? h(
            'section',
            { class: 'card stack' },
            h('h2', null, f.incoming),
            incoming.map((r) =>
              h(
                'div',
                { class: 'row wrap' },
                h('b', { class: 'grow' }, r.display_name || f.noName),
                h('button', { class: 'btn small primary', type: 'button', onclick: async () => { await friends.respond(ctx.client, r.friendship_id!, true); ctx.toast(f.results.accepted); void load() } }, f.accept),
                h('button', { class: 'btn small ghost', type: 'button', onclick: async () => { await friends.respond(ctx.client, r.friendship_id!, false); void load() } }, f.decline),
              ),
            ),
          )
        : null,
      h(
        'section',
        { class: 'card stack' },
        h('div', { class: 'row spread' }, h('h2', null, f.board), h('span', { class: 'small muted' }, f.thisWeek)),
        accepted.length <= 1 ? h('p', { class: 'small muted' }, f.alone) : null,
        h('ol', { class: 'board' }, accepted.map(boardRow)),
        outgoing.length > 0 ? h('p', { class: 'small muted' }, f.waiting(outgoing.map((r) => r.display_name || f.noName).join('، '))) : null,
      ),
    )
  }

  render()
  void load()
  return { el }
}
