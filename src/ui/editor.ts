/**
 * The edit form for a word's content — the same form for a fresh AI draft and for a saved word.
 * It edits a private copy; nothing leaves this form until `read()` returns a valid result.
 */
import {
  ARTICLE_VALUES,
  CEFR_VALUES,
  EXAMPLE_LEVELS,
  LIMITS,
  PERSONS,
  POS_VALUES,
  validateWordContent,
  type Example,
  type SixForms,
  type ValidationIssue,
  type VerbInfo,
  type WordContent,
} from '../../supabase/functions/_shared/wordSchema.ts'
import { h, icon, replace } from './dom.ts'
import { t } from './strings.ts'

export interface Editor {
  el: HTMLElement
  /** The validated content, or the problems that must be fixed first (also shown in the form). */
  read(): { ok: true; value: WordContent } | { ok: false; issues: ValidationIssue[] }
  dirty(): boolean
}

const EMPTY_SIX = (): SixForms => ['', '', '', '', '', '']
const emptyVerb = (): VerbInfo => ({
  separable: false, auxiliary: 'haben', reflexive: 'none', irregular: false, partizip2: '', government: null,
  praesens: EMPTY_SIX(), praeteritum: EMPTY_SIX(), konjunktiv1: EMPTY_SIX(), konjunktiv2: EMPTY_SIX(), imperativ: { du: '', ihr: '', Sie: '' },
})

type InputOptions = { german?: boolean; multiline?: boolean; placeholder?: string; maxLength?: number; path?: string }

export function createEditor(initial: WordContent): Editor {
  const draft: WordContent = structuredClone(initial)
  let dirty = false
  const f = t.draft.fields
  const touch = () => (dirty = true)

  const textInput = (value: string, onInput: (v: string) => void, options: InputOptions = {}): HTMLInputElement | HTMLTextAreaElement => {
    const common = {
      class: `${options.multiline ? 'textarea' : 'input'} ${options.german ? 'de' : ''}`,
      value,
      dir: options.german ? 'ltr' : 'rtl',
      lang: options.german ? 'de' : 'fa',
      placeholder: options.placeholder ?? '',
      maxLength: options.maxLength ?? LIMITS.sentence,
      autocapitalize: 'off',
      autocomplete: 'off',
      spellcheck: false,
      'data-path': options.path,
      oninput: (e: Event) => {
        touch()
        const target = e.target as HTMLInputElement
        target.removeAttribute('aria-invalid')
        onInput(target.value)
      },
    }
    return options.multiline ? h('textarea', { ...common, rows: 2 }) : h('input', { ...common, type: 'text' })
  }

  const field = (label: string, control: Node, className = '') => h('label', { class: `field ${className}` }, h('span', null, label), control)

  const select = <T extends string>(value: T | '', choices: { value: T | ''; label: string }[], onChange: (v: T | '') => void, path?: string) =>
    h(
      'select',
      { class: 'select', 'data-path': path, onchange: (e: Event) => { touch(); onChange((e.target as HTMLSelectElement).value as T | '') } },
      choices.map((c) => h('option', { value: c.value, selected: c.value === value }, c.label)),
    )

  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void) =>
    h('label', { class: 'switch' }, h('span', null, label), h('input', { type: 'checkbox', checked, onchange: (e: Event) => { touch(); onChange((e.target as HTMLInputElement).checked) } }))

  const removeButton = (label: string, onClick: () => void) =>
    h('button', { type: 'button', class: 'icon-btn compact', 'aria-label': label, title: label, onclick: () => { touch(); onClick() } }, icon('trash', { size: 18 }))

  const addButton = (label: string, onClick: () => void) =>
    h('button', { type: 'button', class: 'btn small ghost', onclick: () => { touch(); onClick() } }, icon('plus', { size: 18 }), label)

  // --- sections (each re-renders itself when its structure changes) -------------

  const basics = h('section', { class: 'card stack' })
  const meanings = h('section', { class: 'card stack' })
  const grammar = h('section', { class: 'card stack' })
  const related = h('section', { class: 'card stack' })
  const problems = h('div', { role: 'alert' })

  const renderBasics = () => {
    replace(
      basics,
      h(
        'div',
        { class: 'form-grid' },
        field(f.word, textInput(draft.lemma, (v) => (draft.lemma = v), { german: true, maxLength: LIMITS.lemma, path: 'lemma' }), 'full'),
        field(
          f.pos,
          select(draft.pos, POS_VALUES.map((p) => ({ value: p, label: t.pos[p] })), (v) => {
            if (!v) return
            draft.pos = v
            if (v === 'noun' && !draft.noun) draft.noun = { article: null, plural: null, genitive: null, pluralOnly: false }
            if (v === 'verb' && !draft.verb) draft.verb = emptyVerb()
            if (v === 'adjective' && !draft.adjective) draft.adjective = { comparative: null, superlative: null }
            renderGrammar()
          }, 'pos'),
        ),
        field(
          f.cefr,
          select(draft.cefr ?? '', [{ value: '', label: '—' }, ...CEFR_VALUES.map((c) => ({ value: c, label: c }))], (v) => (draft.cefr = v || null), 'cefr'),
        ),
        field(f.ipa, textInput(draft.ipa ?? '', (v) => (draft.ipa = v || null), { german: true, maxLength: LIMITS.shortText, path: 'ipa' }), 'full'),
      ),
      h('p', { class: 'help' }, t.draft.aiCefrNote),
    )
  }

  const renderMeanings = () => {
    replace(
      meanings,
      draft.meanings.map((meaning, i) =>
        h(
          'div',
          { class: 'form-block' },
          h(
            'div',
            { class: 'row spread' },
            h('h2', null, f.meaning(i + 1)),
            draft.meanings.length > 1 ? removeButton(`${t.common.remove}: ${f.meaning(i + 1)}`, () => { draft.meanings.splice(i, 1); renderMeanings() }) : null,
          ),
          field(f.translation, textInput(meaning.translation, (v) => (meaning.translation = v), { maxLength: LIMITS.shortText, path: `meanings.${i}.translation` })),
          field(`${f.meaningNote} (${t.common.optional})`, textInput(meaning.note ?? '', (v) => (meaning.note = v || null), { maxLength: LIMITS.note, path: `meanings.${i}.note` })),
          h('span', { class: 'label' }, f.examples),
          meaning.examples.map((example, j) =>
            h(
              'div',
              { class: 'stack', style: { gap: '6px' } },
              h(
                'div',
                { class: 'row' },
                h('div', { class: 'grow' }, select(example.level, EXAMPLE_LEVELS.map((l) => ({ value: l, label: t.levels[l] })), (v) => v && (example.level = v))),
                removeButton(`${t.common.remove}: ${f.examples} ${j + 1}`, () => { meaning.examples.splice(j, 1); renderMeanings() }),
              ),
              textInput(example.de, (v) => (example.de = v), { german: true, multiline: true, placeholder: f.exampleDe, path: `meanings.${i}.examples.${j}.de` }),
              textInput(example.fa, (v) => (example.fa = v), { multiline: true, placeholder: f.exampleFa, path: `meanings.${i}.examples.${j}.fa` }),
            ),
          ),
          meaning.examples.length < LIMITS.examplesPerMeaning
            ? addButton(f.addExample, () => {
                const used = new Set(meaning.examples.map((e) => e.level))
                const level: Example['level'] = EXAMPLE_LEVELS.find((l) => !used.has(l)) ?? 'medium'
                meaning.examples.push({ level, de: '', fa: '' })
                renderMeanings()
              })
            : null,
        ),
      ),
      draft.meanings.length < LIMITS.meanings
        ? addButton(f.addMeaning, () => { draft.meanings.push({ translation: '', note: null, examples: [] }); renderMeanings() })
        : null,
    )
  }

  const sixInputs = (title: string, forms: SixForms, path: string) =>
    h(
      'details',
      { class: 'fold' },
      h('summary', null, h('bdi', { class: 'de', lang: 'de', dir: 'ltr' }, title), icon('chevron', { size: 20 })),
      h(
        'div',
        { class: 'six', 'data-path': path },
        PERSONS.flatMap((person, i) => {
          const id = `${path}-${i}`.replace(/\./g, '-')
          return [h('label', { for: id }, person), Object.assign(textInput(forms[i]!, (v) => (forms[i] = v), { german: true, maxLength: LIMITS.shortText }), { id })]
        }),
      ),
    )

  const renderGrammar = () => {
    const children: (Node | null)[] = []
    if (draft.pos === 'noun' && draft.noun) {
      const noun = draft.noun
      children.push(
        h('h2', null, t.detail.grammar),
        h(
          'div',
          { class: 'form-grid' },
          field(f.article, select(noun.article ?? '', [{ value: '', label: '—' }, ...ARTICLE_VALUES.map((a) => ({ value: a, label: a }))], (v) => (noun.article = v || null), 'noun.article')),
          field(f.plural, textInput(noun.plural ?? '', (v) => (noun.plural = v || null), { german: true, maxLength: LIMITS.shortText, path: 'noun.plural' })),
          field(f.genitive, textInput(noun.genitive ?? '', (v) => (noun.genitive = v || null), { german: true, maxLength: LIMITS.shortText, path: 'noun.genitive' }), 'full'),
        ),
        checkbox(f.pluralOnly, noun.pluralOnly, (v) => (noun.pluralOnly = v)),
      )
    } else if (draft.pos === 'verb' && draft.verb) {
      const verb = draft.verb
      children.push(
        h('h2', null, t.detail.conjugation),
        h(
          'div',
          { class: 'form-grid' },
          field(f.partizip2, textInput(verb.partizip2, (v) => (verb.partizip2 = v), { german: true, maxLength: LIMITS.shortText, path: 'verb.partizip2' })),
          field(f.auxiliary, select(verb.auxiliary, [{ value: 'haben', label: 'haben' }, { value: 'sein', label: 'sein' }], (v) => v && (verb.auxiliary = v))),
          field(
            f.reflexive,
            select(verb.reflexive, [{ value: 'none', label: f.reflexiveNone }, { value: 'accusative', label: f.reflexiveAcc }, { value: 'dative', label: f.reflexiveDat }], (v) => v && (verb.reflexive = v)),
          ),
          field(`${f.government} (${t.common.optional})`, textInput(verb.government ?? '', (v) => (verb.government = v || null), { german: true, maxLength: LIMITS.shortText, path: 'verb.government' })),
        ),
        checkbox(f.separable, verb.separable, (v) => (verb.separable = v)),
        checkbox(f.irregular, verb.irregular, (v) => (verb.irregular = v)),
        h(
          'div',
          null,
          sixInputs('Präsens', verb.praesens, 'verb.praesens'),
          sixInputs('Präteritum', verb.praeteritum, 'verb.praeteritum'),
          sixInputs('Konjunktiv I', verb.konjunktiv1, 'verb.konjunktiv1'),
          sixInputs('Konjunktiv II', verb.konjunktiv2, 'verb.konjunktiv2'),
          h(
            'details',
            { class: 'fold' },
            h('summary', null, h('bdi', { class: 'de', lang: 'de', dir: 'ltr' }, 'Imperativ'), icon('chevron', { size: 20 })),
            h(
              'div',
              { class: 'six', 'data-path': 'verb.imperativ' },
              (['du', 'ihr', 'Sie'] as const).flatMap((person) => {
                const id = `imperativ-${person}`
                return [h('label', { for: id }, person), Object.assign(textInput(verb.imperativ[person], (v) => (verb.imperativ[person] = v), { german: true, maxLength: LIMITS.shortText }), { id })]
              }),
            ),
          ),
        ),
        h('p', { class: 'help' }, t.draft.derivedTenses),
      )
    } else if (draft.pos === 'adjective') {
      const adjective = (draft.adjective ??= { comparative: null, superlative: null })
      children.push(
        h('h2', null, t.detail.grammar),
        h(
          'div',
          { class: 'form-grid' },
          field(f.comparative, textInput(adjective.comparative ?? '', (v) => (adjective.comparative = v || null), { german: true, maxLength: LIMITS.shortText })),
          field(f.superlative, textInput(adjective.superlative ?? '', (v) => (adjective.superlative = v || null), { german: true, maxLength: LIMITS.shortText })),
        ),
      )
    }
    grammar.hidden = children.length === 0
    replace(grammar, children)
  }

  const listInput = (label: string, list: string[], path: string) =>
    field(
      label,
      textInput(list.join(', '), (v) => {
        list.length = 0
        list.push(...v.split(/[,،]/).map((s) => s.trim()).filter(Boolean))
      }, { german: true, placeholder: f.listHint, path }),
    )

  const renderRelated = () => {
    replace(
      related,
      listInput(f.synonyms, draft.synonyms, 'synonyms'),
      listInput(f.antonyms, draft.antonyms, 'antonyms'),
      h('span', { class: 'label' }, f.collocations),
      draft.collocations.map((collocation, i) =>
        h(
          'div',
          { class: 'row', style: { alignItems: 'flex-start' } },
          h(
            'div',
            { class: 'grow stack', style: { gap: '6px' } },
            textInput(collocation.de, (v) => (collocation.de = v), { german: true, placeholder: f.exampleDe, path: `collocations.${i}.de` }),
            textInput(collocation.fa, (v) => (collocation.fa = v), { placeholder: f.translation, path: `collocations.${i}.fa` }),
          ),
          removeButton(`${t.common.remove}: ${f.collocations} ${i + 1}`, () => { draft.collocations.splice(i, 1); renderRelated() }),
        ),
      ),
      draft.collocations.length < LIMITS.collocations ? addButton(f.addCollocation, () => { draft.collocations.push({ de: '', fa: '' }); renderRelated() }) : null,
      field(`${f.notes} (${t.common.optional})`, textInput(draft.notes ?? '', (v) => (draft.notes = v || null), { multiline: true, maxLength: LIMITS.note, path: 'notes' })),
    )
  }

  renderBasics()
  renderMeanings()
  renderGrammar()
  renderRelated()
  const el = h('div', { class: 'stack', style: { gap: 'var(--s4)' } }, problems, basics, meanings, grammar, related)

  return {
    el,
    dirty: () => dirty,
    read() {
      // Blocks that do not belong to the chosen part of speech are simply not submitted.
      const candidate = { ...draft, noun: draft.pos === 'noun' ? draft.noun : null, verb: draft.pos === 'verb' ? draft.verb : null, adjective: draft.pos === 'adjective' ? draft.adjective : null }
      const result = validateWordContent(candidate, { mode: 'user' })
      for (const node of el.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid')
      if (result.ok) {
        replace(problems)
        return result
      }
      replace(
        problems,
        h('div', { class: 'notice error' }, icon('info'), h('div', null, h('b', null, t.draft.hasProblems), h('ul', { style: { margin: '4px 0 0', paddingInlineStart: '1.2em' } }, result.issues.slice(0, 6).map((issue) => h('li', null, t.draft.issue(issue)))))),
      )
      let first: HTMLElement | null = null
      for (const issue of result.issues) {
        const node = el.querySelector<HTMLElement>(`[data-path="${issue.path}"]`)
        if (!node) continue
        node.setAttribute('aria-invalid', 'true')
        node.closest('details')?.setAttribute('open', '')
        first ??= node
      }
      problems.scrollIntoView({ block: 'start', behavior: 'smooth' })
      first?.focus({ preventScroll: true })
      return result
    },
  }
}
