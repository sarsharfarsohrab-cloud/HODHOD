/**
 * Create Word: one German word or short expression in → AI draft → preview → (edit) → confirm → Word Bank.
 * Nothing is saved before the learner presses "confirm".
 */
import { validateWordInput } from '../../../supabase/functions/_shared/inputRules.ts'
import type { Word } from '../../core/types.ts'
import { toAppError } from '../../data/errors.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { draftFromResult, draftPanel, saveDraft, type Draft, type DraftPanel } from '../draftPanel.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { iconButton, openSheet, wordTitle } from '../widgets.ts'

type State =
  | { step: 'input'; value: string; error?: string }
  | { step: 'loading'; word: string }
  | { step: 'suggest'; word: string; suggestion: string }
  | { step: 'failed'; word: string; message: string; force: boolean; replaceId: string | null }
  | { step: 'draft'; draft: Draft }

/** An unsaved draft survives moving to another tab of the app and back. */
let parked: Draft | null = null

export function createScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const el = h('main', { class: 'screen' })
  let state: State = parked ? { step: 'draft', draft: parked } : { step: 'input', value: '' }
  let request: AbortController | null = null
  let panel: DraftPanel | null = null
  let saving = false
  let destroyed = false

  const set = (next: State) => {
    if (destroyed) return
    state = next
    parked = next.step === 'draft' ? next.draft : null
    render()
    window.scrollTo({ top: 0 })
  }

  // --- asking the AI ------------------------------------------------------------

  async function analyze(word: string, options: { force?: boolean; replaceId?: string | null } = {}) {
    const replaceId = options.replaceId ?? null
    request?.abort()
    request = new AbortController()
    const mine = request
    set({ step: 'loading', word })
    try {
      const result = await ctx.data.analyzeWord(word, { force: options.force, signal: mine.signal })
      if (mine.signal.aborted || destroyed) return
      if (result.status === 'misspelled') return set({ step: 'suggest', word, suggestion: result.suggestion })
      if (result.status !== 'ok') {
        return set({ step: 'input', value: word, error: result.status === 'wrong_language' ? t.create.wrongLanguage(word) : t.create.notAWord(word) })
      }
      const draft = draftFromResult(result, { replaceId })
      // The lemma may differ from what was typed ("ging" → "gehen"): check for a duplicate again.
      const existing = replaceId ? undefined : ctx.data.findDuplicate(result.content.lemma, result.content.pos)
      set({ step: 'draft', draft })
      if (existing) {
        duplicateSheet(existing, {
          onRegenerate: () => {
            draft.replaceId = existing.id
            render()
          },
          onCancel: () => set({ step: 'input', value: '' }),
        })
      }
    } catch (err) {
      if (mine.signal.aborted || destroyed) return
      const error = toAppError(err)
      if (error.kind === 'validation' && error.code in t.create.inputErrors) return set({ step: 'input', value: word, error: describeError(error) })
      set({ step: 'failed', word, message: describeError(error), force: options.force === true, replaceId })
    }
  }

  function duplicateSheet(existing: Word, handlers: { onRegenerate: () => void; onCancel: () => void }) {
    let handled = false
    openSheet(
      (close) => [
        h('h2', { style: { fontSize: 'var(--text-lg)' } }, t.create.duplicateTitle),
        h('div', { class: 'card flat' }, wordTitle(existing.content, 'div', 'word-title'), h('p', { class: 'muted' }, existing.primaryMeaning)),
        h(
          'div',
          { class: 'stack' },
          h('button', { class: 'btn primary block', 'data-autofocus': '', onclick: () => { handled = true; close(); parked = null; ctx.go(`/words/${existing.id}`) } }, t.create.duplicateOpen),
          h('button', { class: 'btn block', onclick: () => { handled = true; close(); handlers.onRegenerate() } }, icon('refresh', { size: 18 }), t.create.duplicateRegenerate),
          h('button', { class: 'btn ghost block', onclick: close }, t.common.cancel),
        ),
      ],
      { label: t.create.duplicateTitle, onClose: () => !handled && handlers.onCancel() },
    )
  }

  function submit(raw: string) {
    const input = validateWordInput(raw)
    if (!input.ok) return set({ step: 'input', value: raw, error: t.create.inputErrors[input.code] })
    if (!ctx.data.sync.online) return set({ step: 'input', value: raw, error: t.errors.offline })
    const existing = ctx.data.findDuplicate(input.value)
    if (existing) {
      return duplicateSheet(existing, {
        onRegenerate: () => void analyze(input.value, { force: true, replaceId: existing.id }),
        onCancel: () => undefined,
      })
    }
    void analyze(input.value)
  }

  // --- saving ---------------------------------------------------------------------

  async function save(draft: Draft, button: HTMLButtonElement) {
    if (saving || !(panel?.commit() ?? true)) return
    saving = true
    button.disabled = true
    try {
      const word = await saveDraft(ctx, draft)
      parked = null
      state = { step: 'input', value: '' }
      ctx.toast(draft.replaceId ? t.draft.updated : t.draft.saved)
      ctx.go(`/words/${word.id}`, { replace: true })
    } catch (err) {
      const error = toAppError(err)
      if (error.kind === 'duplicate') {
        const existing = ctx.data.findDuplicate(draft.content.lemma, draft.content.pos, draft.replaceId ?? undefined)
        if (existing) duplicateSheet(existing, { onRegenerate: () => { draft.replaceId = existing.id; render() }, onCancel: () => undefined })
        else ctx.toast(describeError(error), 'error')
      } else {
        ctx.toast(error.kind === 'conflict' ? t.draft.conflict : describeError(error), 'error')
      }
    } finally {
      saving = false
      button.disabled = false
    }
  }

  async function discard() {
    if (await ctx.confirm({ title: t.draft.discardConfirm, confirmLabel: t.draft.discard, danger: true })) {
      panel = null
      set({ step: 'input', value: '' })
    }
  }

  // --- rendering --------------------------------------------------------------------

  function render() {
    panel = null
    switch (state.step) {
      case 'input':
        return renderInput(state)
      case 'loading': {
        const { word } = state
        return replace(
          el,
          h(
            'div',
            { class: 'create-loading', role: 'status', 'aria-live': 'polite' },
            mascot('thinking', { size: 132 }),
            de(word, 'word-title'),
            h('p', null, t.create.loading),
            h('p', { class: 'small muted' }, t.create.loadingHint),
            h('button', { class: 'btn', onclick: () => { request?.abort(); set({ step: 'input', value: word }) } }, t.common.cancel),
          ),
        )
      }
      case 'suggest': {
        const { word, suggestion } = state
        return replace(
          el,
          h(
            'div',
            { class: 'create-loading' },
            mascot('confused', { size: 120 }),
            h('p', null, t.create.didYouMean),
            de(suggestion, 'word-title'),
            h(
              'div',
              { class: 'stack', style: { width: '100%', maxWidth: '320px' } },
              h('button', { class: 'btn primary big block', onclick: () => submit(suggestion) }, t.create.useSuggestion),
              h('button', { class: 'btn block', onclick: () => set({ step: 'input', value: word }) }, t.common.no),
            ),
          ),
        )
      }
      case 'failed': {
        const { word, message, force, replaceId } = state
        return replace(
          el,
          h(
            'div',
            { class: 'create-loading', role: 'alert' },
            mascot('supportive', { size: 120 }),
            h('h2', { style: { fontSize: 'var(--text-lg)' } }, t.create.failed),
            h('p', { class: 'muted' }, message),
            h(
              'div',
              { class: 'stack', style: { width: '100%', maxWidth: '320px' } },
              h('button', { class: 'btn primary big block', onclick: () => void analyze(word, { force, replaceId }) }, icon('refresh'), t.common.retry),
              h('button', { class: 'btn block', onclick: () => set({ step: 'input', value: word }) }, t.common.cancel),
            ),
          ),
        )
      }
      case 'draft': {
        const { draft } = state
        const confirm = h('button', { class: 'btn primary big grow', type: 'button' }, icon('check'), draft.replaceId ? t.draft.saveChanges : t.draft.confirm)
        confirm.onclick = () => void save(draft, confirm)
        panel = draftPanel(ctx, draft, { actions: [confirm], banner: true })
        return replace(el, h('header', { class: 'topbar' }, h('h1', null, t.create.title), iconButton('close', t.draft.discard, () => void discard())), panel.el)
      }
    }
  }

  function renderInput(current: Extract<State, { step: 'input' }>) {
    const input = h('input', {
      class: 'input create-input', type: 'text', value: current.value, lang: 'de', dir: 'ltr', placeholder: 'aufgeben', maxLength: 80,
      autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: false, enterKeyHint: 'go',
      'aria-label': t.create.label, 'aria-describedby': 'create-help', 'aria-invalid': current.error ? 'true' : undefined,
    })
    const form = h(
      'form',
      { class: 'card stack', onsubmit: (e: Event) => { e.preventDefault(); submit(input.value) } },
      h('label', { class: 'field' }, h('span', null, t.create.label), input),
      current.error ? h('p', { class: 'error-text', role: 'alert' }, current.error) : null,
      h('p', { class: 'help', id: 'create-help' }, t.create.help),
      h('button', { class: 'btn primary big block', type: 'submit' }, icon('sparkle'), t.create.submit),
    )
    replace(
      el,
      h('header', { class: 'topbar' }, h('h1', null, t.create.title)),
      form,
      h('a', { class: 'card tile', href: '#/import' }, h('div', { class: 'row' }, icon('list'), h('h2', null, t.create.importLink)), h('span', { style: { transform: 'scaleX(-1)', display: 'grid' } }, icon('back', { size: 20 }))),
    )
    // On phones the keyboard would cover half the screen uninvited; focus only where a keyboard is at hand.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches || current.error) input.focus()
  }

  render()
  // "Regenerate" from a word's page arrives here with the word to rebuild.
  const regenerate = params.regenerate ? ctx.data.words.get(params.regenerate) : undefined
  if (regenerate && state.step === 'input') void analyze(regenerate.lemma, { force: true, replaceId: regenerate.id })

  return {
    el,
    destroy() {
      // keep edits made in the form if the learner only switched tabs
      panel?.commit()
      destroyed = true
      request?.abort()
    },
  }
}
