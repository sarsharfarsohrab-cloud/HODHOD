/** Small reusable pieces of interface. */
import { displayWord, type Cefr, type WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import type { WordStatus } from '../core/cards.ts'
import type { ConfirmOptions, Ctx } from './context.ts'
import { de, h, icon, type IconName } from './dom.ts'
import { t } from './strings.ts'

// --- toast -------------------------------------------------------------------

let toastHost: HTMLElement | null = null

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' })
    document.body.appendChild(toastHost)
  }
  // the same message again replaces the one on screen instead of piling up
  for (const shown of [...toastHost.children]) {
    if (shown.textContent === message || toastHost.children.length >= 2) shown.remove()
  }
  const el = h('div', { class: `toast ${kind === 'error' ? 'error' : ''}` }, message)
  toastHost.appendChild(el)
  setTimeout(() => el.remove(), kind === 'error' ? 5200 : 2600)
}

// --- sheet (modal) -----------------------------------------------------------

export interface SheetHandle {
  close(): void
}

/** A modal sheet that traps focus, closes on Escape and on a tap outside. */
export function openSheet(content: (close: () => void) => (Node | null)[], options: { label: string; onClose?: () => void }): SheetHandle {
  const previous = document.activeElement as HTMLElement | null
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKey)
    backdrop.remove()
    options.onClose?.()
    previous?.focus?.()
  }
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': options.label, tabindex: '-1' })
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: (e: Event) => e.target === backdrop && close() }, sheet)
  sheet.append(...content(close).filter((n): n is Node => n !== null))
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return close()
    if (e.key !== 'Tab') return
    const focusable = sheet.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (focusable.length === 0) return
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', onKey)
  document.body.appendChild(backdrop)
  ;(sheet.querySelector<HTMLElement>('[data-autofocus]') ?? sheet).focus()
  return { close }
}

export function confirmSheet(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false
    openSheet(
      (close) => [
        h('h2', { style: { fontSize: 'var(--text-lg)' } }, options.title),
        options.body ? h('p', { class: 'muted' }, options.body) : null,
        h(
          'div',
          { class: 'stack' },
          h(
            'button',
            {
              class: `btn block ${options.danger ? 'danger' : 'primary'}`,
              'data-autofocus': options.danger ? undefined : '',
              onclick: () => {
                answer = true
                close()
              },
            },
            options.confirmLabel,
          ),
          h('button', { class: 'btn block', 'data-autofocus': options.danger ? '' : undefined, onclick: close }, options.cancelLabel ?? t.common.cancel),
        ),
      ],
      { label: options.title, onClose: () => resolve(answer) },
    )
  })
}

// --- buttons --------------------------------------------------------------------

export function iconButton(name: IconName, label: string, onClick: (e: Event) => void, className = ''): HTMLButtonElement {
  return h('button', { class: `icon-btn ${className}`.trim(), type: 'button', 'aria-label': label, title: label, onclick: onClick }, icon(name))
}

/** A play button that pronounces German text with the learner's speed setting. */
export function speakButton(ctx: Ctx, text: string, options: { compact?: boolean; language?: string } = {}): HTMLButtonElement | null {
  const language = options.language ?? ctx.data.profile.activeTargetLanguage
  if (!ctx.audio.canSpeak(language)) return null
  const button = iconButton(
    'speaker',
    `${t.common.play}: ${text}`,
    async (e) => {
      e.stopPropagation()
      e.preventDefault()
      button.classList.add('speaking')
      await ctx.audio.speak(text, language, ctx.data.settings.speechRate)
      button.classList.remove('speaking')
    },
    options.compact ? 'compact' : '',
  )
  return button
}

// --- word pieces ---------------------------------------------------------------------

/** "der Tisch" with the article in its gender colour (and still readable without colour). */
export function wordTitle(content: Pick<WordContent, 'lemma' | 'noun'>, tag: 'h1' | 'div' | 'span' = 'div', className = 'word-title'): HTMLElement {
  const article = content.noun?.article
  const el = h(tag, { class: className, lang: 'de', dir: 'ltr' })
  if (article) el.append(h('span', { class: `article-${article}` }, article), ' ')
  el.append(content.lemma)
  el.setAttribute('aria-label', displayWord(content))
  return el
}

export function cefrChip(cefr: Cefr | null): HTMLElement | null {
  return cefr ? h('span', { class: 'chip cefr' }, cefr) : null
}

export function statusChip(status: WordStatus): HTMLElement {
  return h('span', { class: `chip status-${status}` }, t.status[status])
}

export function deList(items: readonly string[]): HTMLElement {
  return h('div', { class: 'chips' }, items.map((item) => h('span', { class: 'chip' }, de(item))))
}

export function progressBar(ratio: number, label: string): HTMLElement {
  const clamped = Math.min(1, Math.max(0, ratio))
  return h(
    'div',
    { class: `progress ${clamped >= 1 ? 'done' : ''}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(clamped * 100)), 'aria-label': label },
    h('span', { style: { width: `${clamped * 100}%` } }),
  )
}

export function segmented<T extends string>(options: { value: T; label: string }[], current: T, onChange: (value: T) => void, label: string): HTMLElement {
  const el = h('div', { class: 'segmented', role: 'group', 'aria-label': label })
  const render = (value: T) => {
    el.replaceChildren(
      ...options.map((o) =>
        h('button', { type: 'button', 'aria-pressed': String(o.value === value), onclick: () => { render(o.value); onChange(o.value) } }, o.label),
      ),
    )
  }
  render(current)
  return el
}

export function emptyState(parts: { art?: Node; title: string; body?: string; action?: Node }): HTMLElement {
  return h('div', { class: 'empty' }, parts.art ?? null, h('h2', null, parts.title), parts.body ? h('p', null, parts.body) : null, parts.action ?? null)
}

// --- word groups --------------------------------------------------------------------

/**
 * Shows the groups of a word (or of a list being imported) as chips and lets the learner
 * add or remove them. Existing group names are offered, so a group is typed only once.
 */
export function tagEditor(ctx: Ctx, initial: readonly string[], onChange: (tags: string[]) => void, options: { emptyText?: string } = {}): HTMLElement {
  let tags = [...initial]
  const el = h('div', { class: 'stack', style: { gap: 'var(--s2)' } })

  const set = (next: string[]) => {
    tags = next
    onChange([...tags])
    render()
  }
  const add = (raw: string) => {
    const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 30)
    if (!name || tags.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase()) || tags.length >= 20) return
    set([...tags, name])
  }

  const open = () => {
    openSheet(
      (close) => {
        const input = h('input', { class: 'input', type: 'text', maxLength: 30, placeholder: t.tags.placeholder, 'aria-label': t.tags.newTag, 'data-autofocus': '', enterKeyHint: 'done' })
        const form = h('form', { class: 'row', onsubmit: (e: Event) => { e.preventDefault(); add(input.value); close() } }, h('div', { class: 'grow' }, input), h('button', { class: 'btn primary', type: 'submit' }, t.common.add))
        const others = ctx.data.tags().filter((tag) => !tags.includes(tag.name))
        return [
          h('div', { class: 'row spread' }, h('h2', { style: { fontSize: 'var(--text-lg)' } }, t.tags.add), iconButton('close', t.common.close, close)),
          h('label', { class: 'field' }, h('span', null, t.tags.newTag), form),
          others.length
            ? h(
                'div',
                { class: 'stack' },
                h('span', { class: 'label' }, t.tags.existing),
                h('div', { class: 'chips' }, others.map((tag) => h('button', { class: 'chip', type: 'button', onclick: () => { add(tag.name); close() } }, tag.name))),
              )
            : h('p', { class: 'help' }, t.tags.help),
        ]
      },
      { label: t.tags.add },
    )
  }

  const render = () => {
    el.replaceChildren(
      h(
        'div',
        { class: 'chips' },
        tags.map((tag) =>
          h('span', { class: 'chip tag' }, tag, h('button', { class: 'chip-x', type: 'button', 'aria-label': t.tags.remove(tag), onclick: () => set(tags.filter((x) => x !== tag)) }, icon('close', { size: 14 }))),
        ),
        h('button', { class: 'chip', type: 'button', onclick: open }, icon('plus', { size: 16 }), t.tags.add),
      ),
      ...(tags.length === 0 && options.emptyText ? [h('p', { class: 'help' }, options.emptyText)] : []),
    )
  }
  render()
  return el
}
