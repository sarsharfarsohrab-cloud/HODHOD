/** Small forms in a bottom sheet: report a wrong card, or send a problem / idea. */
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { toAppError } from '../data/errors.ts'
import { reportCard, sendFeedback, type FeedbackKind, type ReportReason } from '../data/platform.ts'
import type { Ctx } from './context.ts'
import { h, icon } from './dom.ts'
import { describeError, t } from './strings.ts'
import { openSheet, segmented } from './widgets.ts'

declare const __APP_VERSION__: string | undefined
const version = () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev')

export function openReportSheet(ctx: Ctx, word: { id: string | null; content: WordContent }): void {
  const r = t.report
  let reason: ReportReason = 'meaning'
  openSheet(
    (close) => {
      const message = h('textarea', { class: 'textarea', rows: 3, maxLength: 1000, placeholder: r.messagePlaceholder, 'aria-label': r.message })
      const send = h('button', { class: 'btn primary block', type: 'submit' }, icon('flag', { size: 18 }), r.send)
      const form = h(
        'form',
        {
          class: 'stack',
          onsubmit: async (e: Event) => {
            e.preventDefault()
            send.disabled = true
            try {
              await reportCard(ctx.client, { wordId: word.id, content: word.content, reason, message: message.value })
              close()
              ctx.toast(r.sent)
            } catch (err) {
              ctx.toast(describeError(toAppError(err)), 'error')
              send.disabled = false
            }
          },
        },
        h('h2', null, r.title),
        h('p', { class: 'de small muted', lang: 'de', dir: 'ltr' }, word.content.lemma),
        segmented<ReportReason>(
          (Object.keys(r.reasons) as ReportReason[]).map((k) => ({ value: k, label: r.reasons[k] })),
          reason,
          (v) => (reason = v),
          r.title,
        ),
        h('label', { class: 'field' }, h('span', null, r.message), message),
        send,
      )
      return [form]
    },
    { label: r.title },
  )
}

export function openFeedbackSheet(ctx: Ctx): void {
  const f = t.feedback
  let kind: FeedbackKind = 'bug'
  openSheet(
    (close) => {
      const message = h('textarea', { class: 'textarea', rows: 5, maxLength: 2000, placeholder: f.placeholder, 'aria-label': f.title, 'data-autofocus': '' })
      const send = h('button', { class: 'btn primary block', type: 'submit' }, icon('message', { size: 18 }), f.send)
      const form = h(
        'form',
        {
          class: 'stack',
          onsubmit: async (e: Event) => {
            e.preventDefault()
            if (!message.value.trim()) return ctx.toast(f.empty, 'error')
            send.disabled = true
            try {
              await sendFeedback(ctx.client, kind, message.value, {
                screen: location.hash.slice(0, 100),
                version: version(),
                agent: navigator.userAgent.slice(0, 200),
                words: ctx.data.words.size,
              })
              close()
              ctx.toast(f.sent)
            } catch (err) {
              ctx.toast(describeError(toAppError(err)), 'error')
              send.disabled = false
            }
          },
        },
        h('h2', null, f.title),
        h('p', { class: 'help' }, f.hint),
        segmented<FeedbackKind>((Object.keys(f.kinds) as FeedbackKind[]).map((k) => ({ value: k, label: f.kinds[k] })), kind, (v) => (kind = v), f.title),
        message,
        send,
      )
      return [form]
    },
    { label: f.title },
  )
}
