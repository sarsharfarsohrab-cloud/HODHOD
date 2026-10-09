/** Read-only presentation of a word's content. Used by Word Detail and by the draft preview. */
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { buildConjugation, spokenForm } from '../core/conjugation.ts'
import type { Ctx } from './context.ts'
import { de, h, icon } from './dom.ts'
import { fa } from './format.ts'
import { t } from './strings.ts'
import { cefrChip, deList, speakButton, wordTitle } from './widgets.ts'

export function wordHeader(ctx: Ctx, content: WordContent, trailing: (Node | null)[] = []): HTMLElement {
  const spoken = content.noun?.article ? `${content.noun.article} ${content.lemma}` : content.lemma
  return h(
    'div',
    { class: 'card stack' },
    h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' }, wordTitle(content, 'h1')), speakButton(ctx, spoken), ...trailing),
    h(
      'div',
      { class: 'row wrap' },
      h('span', { class: 'chip' }, t.pos[content.pos]),
      cefrChip(content.cefr),
      content.ipa ? h('span', { class: 'ipa' }, `[${content.ipa}]`) : null,
    ),
  )
}

export function meaningsCard(ctx: Ctx, content: WordContent): HTMLElement {
  const many = content.meanings.length > 1
  return h(
    'section',
    { class: 'card' },
    h('h2', null, t.detail.meanings),
    content.meanings.map((meaning, i) =>
      h(
        'div',
        { class: 'meaning' },
        h('div', { class: 'meaning-title' }, many ? h('span', { class: 'meaning-index', 'aria-hidden': 'true' }, fa(i + 1)) : null, meaning.translation),
        meaning.note ? h('p', { class: 'small muted' }, meaning.note) : null,
        meaning.examples.map((example) =>
          h(
            'div',
            { class: 'example' },
            h('div', null, h('span', { class: 'example-level' }, t.levels[example.level]), de(example.de)),
            speakButton(ctx, example.de, { compact: true }),
            h('span', { class: 'fa' }, example.fa),
          ),
        ),
      ),
    ),
  )
}

function fact(label: string, value: Node | string | null): (HTMLElement | null)[] {
  if (value === null || value === '') return []
  return [h('dt', null, label), h('dd', null, value)]
}

export function grammarCard(ctx: Ctx, content: WordContent): HTMLElement | null {
  const d = t.detail
  const rows: (HTMLElement | null)[] = []
  if (content.noun) {
    const n = content.noun
    if (n.pluralOnly) rows.push(...fact(d.plural, d.pluralOnly))
    else rows.push(...fact(d.plural, n.plural ? de(`die ${n.plural}`) : d.noPlural))
    rows.push(...fact(d.genitive, n.genitive ? de(`${n.article === 'die' ? 'der' : 'des'} ${n.genitive}`) : null))
  }
  if (content.verb) {
    const v = content.verb
    rows.push(...fact(d.auxiliary, de(v.auxiliary)))
    rows.push(...fact('Partizip II', de(v.partizip2)))
    rows.push(...fact('Präteritum', de(`${v.praeteritum[2]}`)))
    const traits = [v.separable ? d.separable : null, v.irregular ? d.irregular : d.regular, v.reflexive !== 'none' ? d.reflexive : null].filter(Boolean).join('، ')
    rows.push(...fact(d.traits, traits))
    rows.push(...fact(d.government, v.government ? de(v.government) : null))
  }
  if (content.adjective) {
    rows.push(...fact(d.comparative, content.adjective.comparative ? de(content.adjective.comparative) : null))
    rows.push(...fact(d.superlative, content.adjective.superlative ? de(content.adjective.superlative) : null))
  }
  if (rows.length === 0) return null
  return h('section', { class: 'card' }, h('h2', null, d.grammar), h('dl', { class: 'facts' }, rows))
}

export function conjugationCard(ctx: Ctx, content: WordContent): HTMLElement | null {
  if (!content.verb) return null
  const tables = buildConjugation(content.lemma, content.verb)
  return h(
    'section',
    { class: 'card' },
    h('h2', null, t.detail.conjugation),
    tables.map((table, index) =>
      h(
        'details',
        // the whole table reads left to right, heading included
        { class: 'fold', open: index === 0, dir: 'ltr' },
        h('summary', null, de(table.title), icon('chevron', { size: 20 })),
        h(
          'table',
          { class: 'conj' },
          h(
            'tbody',
            null,
            table.rows.map((row) =>
              h('tr', null, h('td', null, row.person), h('td', { class: 'form', lang: 'de' }, row.form), h('td', null, speakButton(ctx, spokenForm(row), { compact: true }))),
            ),
          ),
        ),
      ),
    ),
  )
}

export function relatedCards(content: WordContent): (HTMLElement | null)[] {
  const d = t.detail
  return [
    content.collocations.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', null, d.collocations),
          h('div', { class: 'stack' }, content.collocations.map((c) => h('div', { class: 'example' }, h('div', null, de(c.de)), h('span', { class: 'fa' }, c.fa)))),
        )
      : null,
    content.synonyms.length || content.antonyms.length
      ? h(
          'section',
          { class: 'card stack' },
          content.synonyms.length ? h('div', { class: 'stack' }, h('h2', null, d.synonyms), deList(content.synonyms)) : null,
          content.antonyms.length ? h('div', { class: 'stack' }, h('h2', null, d.antonyms), deList(content.antonyms)) : null,
        )
      : null,
    content.notes ? h('section', { class: 'card' }, h('h2', null, d.notes), h('p', null, content.notes)) : null,
  ]
}

/** The whole body of a word, in reading order. */
export function wordBody(ctx: Ctx, content: WordContent): (HTMLElement | null)[] {
  return [meaningsCard(ctx, content), grammarCard(ctx, content), conjugationCard(ctx, content), ...relatedCards(content)]
}
