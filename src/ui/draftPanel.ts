/**
 * An unsaved word: preview, edit form and the save step. Used for a single new word
 * (Create Word) and for each card of a batch import. Nothing here writes to the Word
 * Bank until `saveDraft` is called.
 */
import type { AnalyzeResult } from '../../supabase/functions/_shared/analyzeWord.ts'
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import type { Word } from '../core/types.ts'
import type { Ctx } from './context.ts'
import { h, icon } from './dom.ts'
import { createEditor, type Editor } from './editor.ts'
import { t } from './strings.ts'
import { iconButton, tagEditor } from './widgets.ts'
import { wordBody, wordHeader } from './wordView.ts'

export type OkResult = Extract<AnalyzeResult, { status: 'ok' }>

export interface Draft {
  content: WordContent
  inputNote: string | null
  promptVersion: string
  model: string
  favorite: boolean
  tags: string[]
  /** Set when the draft replaces the content of a word that is already in the bank. */
  replaceId: string | null
  editing: boolean
  /** True once the learner changed something: the saved word is then no longer "what the AI said". */
  changed: boolean
}

export function draftFromResult(result: OkResult, options: { replaceId?: string | null; tags?: readonly string[] } = {}): Draft {
  return {
    content: result.content,
    inputNote: result.inputNote,
    promptVersion: result.promptVersion,
    model: result.model,
    favorite: false,
    tags: [...(options.tags ?? [])],
    replaceId: options.replaceId ?? null,
    editing: false,
    changed: false,
  }
}

/** Writes a confirmed draft to the Word Bank (or over the word it replaces). Throws AppError. */
export async function saveDraft(ctx: Ctx, draft: Draft): Promise<Word> {
  if (draft.replaceId) {
    const word = await ctx.data.updateWordContent(draft.replaceId, draft.content)
    if (draft.favorite) await ctx.data.setFavorite(word.id, true)
    if (draft.tags.length) await ctx.data.setTags(word.id, [...new Set([...word.tags, ...draft.tags])])
    return word
  }
  return ctx.data.saveWord(draft.content, {
    source: draft.changed ? 'manual' : 'ai',
    promptVersion: draft.promptVersion,
    model: draft.model,
    favorite: draft.favorite,
    tags: draft.tags,
  })
}

export interface DraftPanel {
  el: HTMLElement
  /** Takes what is in the edit form into the draft. False (with the problems shown) if it is not valid. */
  commit(): boolean
}

export interface DraftPanelOptions {
  /** Buttons shown next to the edit/preview switch, e.g. "confirm and save". */
  actions: (Node | null)[]
  /** Explains that this is a draft. Omit where the surrounding screen already says so. */
  banner?: boolean
  /** Icon-only edit switch, for screens with several actions. */
  compactToggle?: boolean
}

export function draftPanel(ctx: Ctx, draft: Draft, options: DraftPanelOptions): DraftPanel {
  const el = h('div', { class: 'stack', style: { gap: 'var(--s4)' } })
  let editor: Editor | null = null

  const commit = (): boolean => {
    if (!editor) return true
    const result = editor.read()
    if (!result.ok) return false
    if (editor.dirty()) draft.changed = true
    draft.content = result.value
    return true
  }

  const render = () => {
    const favorite = iconButton('star', t.draft.fields.favorite, () => {
      draft.favorite = !draft.favorite
      render()
    }, draft.favorite ? 'on' : '')
    favorite.setAttribute('aria-pressed', String(draft.favorite))
    if (draft.favorite) favorite.replaceChildren(icon('star', { filled: true }))

    let body: (Node | null)[]
    if (draft.editing) {
      editor ??= createEditor(draft.content)
      body = [editor.el]
    } else {
      editor = null
      body = [
        wordHeader(ctx, draft.content, [favorite]),
        ...wordBody(ctx, draft.content),
        h('section', { class: 'card stack' }, h('h2', null, t.tags.title), tagEditor(ctx, draft.tags, (tags) => (draft.tags = tags), { emptyText: t.tags.help })),
      ]
    }

    const toggle = h(
      'button',
      {
        class: `btn big ${options.compactToggle ? 'square' : ''}`,
        type: 'button',
        'aria-label': draft.editing ? 'پیش‌نمایش' : t.common.edit,
        title: draft.editing ? 'پیش‌نمایش' : t.common.edit,
        onclick: () => {
          if (draft.editing && !commit()) return
          draft.editing = !draft.editing
          render()
          window.scrollTo({ top: 0 })
        },
      },
      icon(draft.editing ? 'check' : 'edit'),
      options.compactToggle ? null : draft.editing ? 'پیش‌نمایش' : t.common.edit,
    )

    el.replaceChildren(
      ...([
        options.banner ? h('div', { class: 'notice warn draft-banner' }, icon('edit'), h('span', null, t.draft.banner)) : null,
        draft.inputNote ? h('div', { class: 'notice' }, icon('info'), h('span', null, draft.inputNote)) : null,
        ...body,
        h('div', { class: 'sticky-actions' }, toggle, ...options.actions),
      ].filter((node): node is Node => node !== null)),
    )
  }

  render()
  return { el, commit }
}
