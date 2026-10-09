/**
 * Batch import: a pasted, typed or scanned list of words → one AI draft per word →
 * the learner confirms, edits or skips each card. As everywhere, nothing is saved
 * without a confirmation.
 *
 * The list lives outside the screen, so drafts already paid for are not lost when the
 * learner looks something up in another tab and comes back.
 */
import { splitWordList, validateWordInput } from '../../../supabase/functions/_shared/inputRules.ts'
import type { AppData } from '../../data/appData.ts'
import { toAppError } from '../../data/errors.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { draftFromResult, draftPanel, saveDraft, type Draft, type DraftPanel } from '../draftPanel.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { emptyState, iconButton, progressBar, tagEditor } from '../widgets.ts'

export const MAX_IMPORT = 40
const LIMIT_PAUSE_MS = 20_000
const LIMIT_RETRIES = 6

type ItemStatus =
  | 'pending' // waiting to be generated
  | 'loading'
  | 'ready' // draft waiting for the learner
  | 'saved'
  | 'skipped' // the learner said no
  | 'exists' // already in the Word Bank (or twice in this list)
  | 'failed'

interface Item {
  input: string
  status: ItemStatus
  draft?: Draft
  /** Why it failed, in the learner's language. */
  message?: string
  /** Set when the AI corrected the spelling, so the learner sees what happened. */
  note?: string
}

interface ImportSession {
  owner: AppData
  step: 'input' | 'list' | 'run'
  text: string
  tags: string[]
  items: Item[]
  running: boolean
  /** Generation stopped early (offline, daily limit): pending items can be resumed. */
  stoppedBecause: string | null
  waitingForLimit: boolean
  listeners: Set<() => void>
  stop: AbortController | null
}

let session: ImportSession | null = null

function freshSession(owner: AppData): ImportSession {
  return { owner, step: 'input', text: '', tags: [], items: [], running: false, stoppedBecause: null, waitingForLimit: false, listeners: new Set(), stop: null }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })

/** Generates the drafts one after another. Runs on even while the screen is not shown. */
async function generate(ctx: Ctx, s: ImportSession): Promise<void> {
  if (s.running) return
  s.running = true
  s.stoppedBecause = null
  s.stop = new AbortController()
  const signal = s.stop.signal
  const changed = () => s.listeners.forEach((listener) => listener())

  const lemmaKey = (draft: Draft) => `${draft.content.pos}|${draft.content.lemma}`
  try {
    for (const item of s.items) {
      if (signal.aborted) break
      if (item.status !== 'pending') continue
      item.status = 'loading'
      changed()

      let word = item.input
      let attemptsLeft = LIMIT_RETRIES
      for (;;) {
        try {
          const result = await ctx.data.analyzeWord(word, { signal })
          if (result.status === 'misspelled' && word === item.input) {
            // one obvious correction is followed automatically; the learner is told
            item.note = t.import.suggestion(item.input, result.suggestion)
            word = result.suggestion
            continue
          }
          if (result.status !== 'ok') {
            item.status = 'failed'
            item.message = result.status === 'wrong_language' ? t.create.wrongLanguage(word) : t.create.notAWord(word)
            break
          }
          const draft = draftFromResult(result, { tags: s.tags })
          const twin = s.items.some((other) => other !== item && other.draft && lemmaKey(other.draft) === lemmaKey(draft) && other.status !== 'failed')
          if (twin || ctx.data.findDuplicate(result.content.lemma, result.content.pos)) {
            item.status = 'exists'
          } else {
            item.draft = draft
            item.status = 'ready'
          }
          break
        } catch (err) {
          if (signal.aborted) {
            item.status = 'pending'
            break
          }
          const error = toAppError(err)
          if (error.kind === 'rate_limit' && error.detail.scope === 'minute' && attemptsLeft-- > 0) {
            s.waitingForLimit = true
            changed()
            await sleep(LIMIT_PAUSE_MS, signal)
            s.waitingForLimit = false
            continue
          }
          if (error.kind === 'offline' || error.kind === 'rate_limit' || error.kind === 'auth' || error.kind === 'not_configured') {
            // no point in trying the rest now: keep them for "try again"
            item.status = 'pending'
            s.stoppedBecause = describeError(error)
            return
          }
          item.status = 'failed'
          item.message = describeError(error)
          break
        }
      }
      changed()
    }
  } finally {
    s.running = false
    s.waitingForLimit = false
    s.stop = null
    changed()
  }
}

export function importScreen(ctx: Ctx): Screen {
  if (!session || session.owner !== ctx.data) session = freshSession(ctx.data)
  let s = session
  const el = h('main', { class: 'screen' })
  let panel: DraftPanel | null = null
  let shownItem: Item | null = null
  let saving = false

  const header = (title: string, back: () => void) =>
    h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, onclick: back }, icon('back')), h('h1', null, title))

  // --- step 1: the list as text ----------------------------------------------------

  function renderInput(error?: string) {
    const area = h('textarea', {
      class: 'textarea de import-area', rows: 9, lang: 'de', dir: 'ltr', value: s.text, placeholder: t.import.placeholder,
      autocapitalize: 'off', autocomplete: 'off', spellcheck: false, 'aria-label': t.import.listLabel, 'aria-describedby': 'import-help',
      oninput: () => (s.text = area.value),
    })
    replace(
      el,
      header(t.import.title, () => ctx.go('/create')),
      h(
        'form',
        {
          class: 'card stack',
          onsubmit: (e: Event) => {
            e.preventDefault()
            const entries = splitWordList(area.value)
            if (entries.length === 0) return renderInput(t.import.nothing)
            const tooMany = entries.length > MAX_IMPORT
            s.items = entries.slice(0, MAX_IMPORT).map((input): Item => {
              const valid = validateWordInput(input)
              if (!valid.ok) return { input, status: 'failed', message: t.create.inputErrors[valid.code] }
              return { input: valid.value, status: ctx.data.findDuplicate(valid.value) ? 'exists' : 'pending' }
            })
            s.step = 'list'
            render()
            if (tooMany) ctx.toast(t.import.tooMany(MAX_IMPORT))
          },
        },
        h('p', { id: 'import-help' }, t.import.intro),
        area,
        error ? h('p', { class: 'error-text', role: 'alert' }, error) : null,
        h('p', { class: 'notice' }, icon('info', { size: 18 }), h('span', null, t.import.scanTip)),
        h('div', { class: 'stack' }, h('span', { class: 'label' }, t.import.tagLabel), tagEditor(ctx, s.tags, (tags) => (s.tags = tags))),
        h('button', { class: 'btn primary big block', type: 'submit' }, t.import.check),
      ),
    )
  }

  // --- step 2: what will be built -----------------------------------------------------

  function renderList() {
    const buildable = s.items.filter((item) => item.status === 'pending').length
    const label = (item: Item) => (item.status === 'pending' ? t.import.statusNew : item.status === 'exists' ? t.import.statusExists : item.message ?? t.import.statusInvalid)
    replace(
      el,
      header(t.import.reviewTitle(buildable), () => { s.step = 'input'; render() }),
      h(
        'ul',
        { class: 'word-list' },
        s.items.map((item) =>
          h(
            'li',
            { class: `word-row ${item.status === 'pending' ? '' : 'dim'}` },
            h('div', { class: 'grow', style: { minWidth: '0', padding: 'var(--s1) 0' } }, de(item.input), h('div', { class: 'meaning-line' }, label(item))),
            iconButton('close', t.import.removeItem(item.input), () => { s.items = s.items.filter((other) => other !== item); s.items.length ? renderList() : (s.step = 'input', render()) }, 'compact'),
          ),
        ),
      ),
      buildable === 0 ? h('p', { class: 'notice warn' }, icon('info', { size: 18 }), t.import.nothingToBuild) : null,
      h(
        'div',
        { class: 'sticky-actions' },
        h('button', { class: 'btn big', type: 'button', onclick: () => { s.step = 'input'; render() } }, t.import.editList),
        h(
          'button',
          {
            class: 'btn primary big grow',
            type: 'button',
            disabled: buildable === 0,
            onclick: () => {
              if (!ctx.data.sync.online) return ctx.toast(t.errors.offline, 'error')
              s.items = s.items.filter((item) => item.status === 'pending')
              s.step = 'run'
              render()
              void generate(ctx, s)
            },
          },
          icon('sparkle'),
          t.import.start(buildable),
        ),
      ),
    )
  }

  // --- step 3: generate and confirm one by one ---------------------------------------------

  async function confirm(item: Item, button: HTMLButtonElement) {
    if (saving || !item.draft || !(panel?.commit() ?? true)) return
    saving = true
    button.disabled = true
    try {
      await saveDraft(ctx, item.draft)
      item.status = 'saved'
      shownItem = null
      render()
      window.scrollTo({ top: 0 })
    } catch (err) {
      const error = toAppError(err)
      if (error.kind === 'duplicate') {
        item.status = 'exists'
        shownItem = null
        render()
      } else {
        ctx.toast(describeError(error), 'error')
        button.disabled = false
      }
    } finally {
      saving = false
    }
  }

  function renderRun() {
    const total = s.items.length
    const count = (...statuses: ItemStatus[]) => s.items.filter((item) => statuses.includes(item.status)).length
    const handled = count('saved', 'skipped', 'exists', 'failed')
    const prepared = total - count('pending', 'loading')
    const current = s.items.find((item) => item.status === 'ready')

    const top = h(
      'div',
      { class: 'stack', style: { gap: 'var(--s2)' } },
      h('div', { class: 'row spread small muted' }, h('span', { 'aria-live': 'polite' }, t.import.progress(prepared, total)), current ? h('span', null, t.import.position(s.items.indexOf(current) + 1, total)) : null),
      progressBar(total ? handled / total : 1, t.import.progress(prepared, total)),
      s.waitingForLimit ? h('p', { class: 'notice' }, icon('clock', { size: 18 }), t.import.limitWait) : null,
    )

    // 3a. a card to decide on
    if (current?.draft) {
      // keep the form the learner is typing in when only the progress numbers changed
      if (shownItem === current && panel && el.contains(panel.el)) {
        el.querySelector('.import-top')?.replaceWith(Object.assign(top, { className: 'stack import-top' }))
        return
      }
      shownItem = current
      const save = h('button', { class: 'btn primary big grow', type: 'button' }, icon('check'), t.import.confirm)
      save.onclick = () => void confirm(current, save)
      const skip = h('button', { class: 'btn big', type: 'button', onclick: () => { current.status = 'skipped'; shownItem = null; render(); window.scrollTo({ top: 0 }) } }, t.import.skip)
      panel = draftPanel(ctx, current.draft, { actions: [skip, save], compactToggle: true })
      top.className = 'stack import-top'
      return replace(el, header(t.import.title, () => ctx.go('/create')), top, current.note ? h('p', { class: 'notice' }, icon('info', { size: 18 }), current.note) : null, panel.el)
    }
    panel = null
    shownItem = null

    // 3b. still generating
    if (s.running) {
      const loading = s.items.find((item) => item.status === 'loading')
      return replace(
        el,
        header(t.import.title, () => ctx.go('/create')),
        top,
        h('div', { class: 'create-loading', role: 'status' }, mascot('thinking', { size: 120 }), loading ? de(loading.input, 'word-title') : null, h('p', null, t.import.waiting)),
      )
    }

    // 3c. finished (or stopped early)
    const failed = s.items.filter((item) => item.status === 'failed')
    const pending = count('pending')
    replace(
      el,
      header(t.import.title, () => ctx.go('/create')),
      emptyState({
        art: mascot(pending > 0 ? 'supportive' : count('saved') > 0 ? 'celebrating' : 'idle', { size: 132 }),
        title: pending > 0 ? t.import.paused : t.import.doneTitle,
        body: pending > 0 ? s.stoppedBecause ?? undefined : t.import.doneSummary(count('saved'), count('skipped') + count('exists'), failed.length),
        action: h(
          'div',
          { class: 'stack', style: { width: '100%', maxWidth: '340px' } },
          pending > 0 ? h('button', { class: 'btn primary big block', type: 'button', onclick: () => { render(); void generate(ctx, s) } }, icon('refresh'), t.import.retryFailed) : null,
          h('button', { class: `btn big block ${pending > 0 ? '' : 'primary'}`, type: 'button', onclick: () => { session = freshSession(ctx.data); ctx.go('/words') } }, t.import.toBank),
          h('button', { class: 'btn block', type: 'button', onclick: () => { s = session = freshSession(ctx.data); rebind(); render() } }, t.import.again),
        ),
      }),
      failed.length
        ? h('section', { class: 'card stack' }, failed.map((item) => h('p', { class: 'small' }, t.import.failed(item.input, item.message ?? t.import.statusInvalid))))
        : null,
    )
  }

  function render() {
    if (s.step === 'input') return renderInput()
    if (s.step === 'list') return renderList()
    renderRun()
  }

  // The session object is replaced when the learner starts over; follow it.
  let bound = s
  const onChange = () => s === bound && s.step === 'run' && renderRun()
  function rebind() {
    bound.listeners.delete(onChange)
    bound = s
    bound.listeners.add(onChange)
  }
  s.listeners.add(onChange)
  render()

  return {
    el,
    onData: () => undefined,
    destroy() {
      panel?.commit()
      bound.listeners.delete(onChange)
    },
  }
}
