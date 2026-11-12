/**
 * Turns the hand-written packs (restaurant.ts, …) into full cards and checks every card against
 * the card schema. `scripts/curated-packs.ts` writes the results to disk.
 */
import { restaurantPacks } from './restaurant.ts'
import type { CuratedLine, CuratedPack, CuratedWord, VerbSpec } from './types.ts'
import { normalizeLemma } from '../../../supabase/functions/_shared/inputRules.ts'
import { CONTENT_VERSION, displayWord, validateWordContent, type SixForms, type VerbInfo, type WordContent } from '../../../supabase/functions/_shared/wordSchema.ts'

export interface BuiltItem {
  position: number
  lesson: number
  input: string
  hint: string | null
  lemma: string
  normalized_lemma: string
  pos: string
  cefr: string | null
  primary_meaning: string
  content: WordContent
}
export interface BuiltPack {
  slug: string
  topic: string
  kind: string
  level: string
  emoji: string
  title: string
  description: string
  lesson_size: number
  lesson_titles: string[]
  items: BuiltItem[]
}

const ARTICLE = { m: 'der', f: 'die', n: 'das' } as const

/** The simple tenses of a German verb from its principal parts. */
export function conjugate(infinitive: string, v: VerbSpec): VerbInfo {
  const prefix = v.sep ?? ''
  const base = prefix ? infinitive.slice(prefix.length) : infinitive
  const stem = base.replace(/en$/, '')
  const after = (form: string) => (prefix ? `${form} ${prefix}` : form)
  const six = (forms: string[]) => forms.map(after) as SixForms
  const dental = (s: string) => /[td]$/.test(s)
  const sibilant = (s: string) => /(s|ß|z|x)$/.test(s)
  const e = dental(stem) ? 'e' : ''

  const praesens = six([
    `${stem}e`,
    v.du ?? `${stem}${dental(stem) ? 'est' : sibilant(stem) ? 't' : 'st'}`,
    v.er ?? `${stem}${e}t`,
    base,
    `${stem}${e}t`,
    base,
  ])
  const weak = (s: string) => {
    const t = `${s}${dental(s) ? 'ete' : 'te'}`
    return [t, `${t}st`, t, `${t}n`, `${t}t`, `${t}n`]
  }
  const strongPast = (p: string) => [p, `${p}${dental(p) ? 'est' : sibilant(p) ? 't' : 'st'}`, p, `${p}en`, `${p}${dental(p) ? 'et' : 't'}`, `${p}en`]
  const subjunctive = (s: string) => [`${s}e`, `${s}est`, `${s}e`, `${s}en`, `${s}et`, `${s}en`]

  const praeteritum = six(v.prat ? strongPast(v.prat) : weak(v.pratWeak ?? stem))
  const konjunktiv2 = six(v.k2 ? subjunctive(v.k2) : weak(v.k2Weak ?? v.pratWeak ?? stem))
  const konjunktiv1 = six(subjunctive(stem))
  const du = v.imp ?? (dental(stem) ? `${stem}e` : stem)
  return {
    separable: Boolean(prefix),
    auxiliary: v.aux ?? 'haben',
    reflexive: 'none',
    irregular: v.irregular === true,
    partizip2: v.p2,
    government: v.gov ?? null,
    praesens,
    praeteritum,
    konjunktiv1,
    konjunktiv2,
    imperativ: { du: after(du), ihr: after(`${stem}${e}t`), Sie: after(`${base} Sie`) },
  }
}

const blank = () => ({ ipa: null, noun: null, verb: null, adjective: null, synonyms: [] as string[], antonyms: [] as string[], collocations: [], notes: null })

function wordCard(word: CuratedWord): WordContent {
  const pos = word.g ? 'noun' : word.p!
  return {
    ...blank(),
    version: CONTENT_VERSION,
    lemma: word.w,
    pos,
    cefr: word.lv,
    meanings: [{ translation: word.fa, note: null, examples: [{ level: 'easy', de: word.ex[0], fa: word.ex[1] }] }],
    noun: word.g
      ? word.g === 'pl'
        ? { article: null, gender: null, plural: null, genitive: null, pluralOnly: true }
        : { article: ARTICLE[word.g], gender: word.g, plural: word.pl ?? null, genitive: null, pluralOnly: false }
      : null,
    verb: pos === 'verb' ? conjugate(word.w, word.v!) : null,
    adjective: word.cmp ? { comparative: word.cmp[0], superlative: word.cmp[1] } : null,
    notes: word.tip ?? null,
  }
}

function lineCard(line: CuratedLine): WordContent {
  return {
    ...blank(),
    version: CONTENT_VERSION,
    lemma: line.de,
    pos: 'sentence',
    cefr: line.lv,
    meanings: [{ translation: line.fa, note: null, examples: [] }],
    notes: line.when,
    literal: line.lit ?? null,
    register: line.informal || / (dich|du|dir) /.test(` ${line.de} `) ? 'informal' : 'neutral',
    frequency: 3,
    alternatives: line.alt ?? [],
    reply: line.reply ? { de: line.reply[0], fa: line.reply[1] } : null,
  }
}

/** Builds and checks every pack; throws with a list of what is wrong. */
export function buildCurated(packs: readonly CuratedPack[] = restaurantPacks): BuiltPack[] {
  const problems: string[] = []
  const built = packs.map((pack): BuiltPack => {
    const items: BuiltItem[] = []
    const seen = new Set<string>()
    pack.groups.forEach((group, g) => {
      const entries: { card: WordContent; hint: string | null }[] = [
        ...(group.words ?? []).map((w) => ({ card: wordCard(w), hint: null })),
        ...(group.lines ?? []).map((l) => ({ card: lineCard(l), hint: l.who })),
      ]
      if (entries.length < 3) problems.push(`${pack.slug}: group "${group.title}" is too small`)
      for (const { card, hint } of entries) {
        const result = validateWordContent(card, { mode: 'user', target: 'de', native: 'fa' })
        if (!result.ok) {
          problems.push(`${pack.slug} / ${card.lemma}: ${result.issues.map((i) => `${i.path}:${i.code}`).join(', ')}`)
          continue
        }
        const key = `${normalizeLemma(card.lemma)}|${card.pos}`
        if (seen.has(key)) problems.push(`${pack.slug}: "${card.lemma}" appears twice`)
        seen.add(key)
        items.push({
          position: items.length,
          lesson: g + 1,
          input: displayWord(result.value),
          hint,
          lemma: result.value.lemma,
          normalized_lemma: normalizeLemma(result.value.lemma),
          pos: result.value.pos,
          cefr: result.value.cefr,
          primary_meaning: result.value.meanings[0]!.translation,
          content: result.value,
        })
      }
    })
    const largest = Math.max(...pack.groups.map((g) => (g.words?.length ?? 0) + (g.lines?.length ?? 0)))
    return {
      slug: pack.slug,
      topic: 'restaurant',
      kind: pack.kind,
      level: pack.level,
      emoji: pack.emoji,
      title: pack.title,
      description: pack.description,
      lesson_size: Math.min(40, Math.max(5, largest)),
      lesson_titles: pack.groups.map((g) => g.title),
      items,
    }
  })
  if (problems.length > 0) throw new Error(`curated packs:\n${problems.join('\n')}`)
  return built
}

const q = (value: string | null) => (value === null ? 'null' : `'${value.replace(/'/g, "''")}'`)

/** One SQL script that adds (or refreshes) the packs. They arrive unpublished. */
export function seedSql(packs: readonly BuiltPack[]): string {
  const out: string[] = [
    '-- Hand-written packs (content/packs/curated). Written by scripts/curated-packs.ts — do not edit by hand.',
    '-- Safe to run more than once: packs are matched by their slug, entries by their place in the pack.',
    '-- New packs arrive unpublished; publish them from the admin panel after reading them.',
    '',
    'alter table public.packs add column if not exists lesson_titles jsonb;',
    '',
  ]
  for (const pack of packs) {
    out.push(
      `insert into public.packs (slug, topic, kind, level, title, description, emoji, lesson_size, lesson_titles, published, target_language, native_language)`,
      `values (${q(pack.slug)}, ${q(pack.topic)}, ${q(pack.kind)}, ${q(pack.level)}, ${q(pack.title)}, ${q(pack.description)}, ${q(pack.emoji)}, ${pack.lesson_size}, ${q(JSON.stringify(pack.lesson_titles))}::jsonb, false, 'de', 'fa')`,
      `on conflict (slug) do update set topic = excluded.topic, kind = excluded.kind, level = excluded.level, title = excluded.title,`,
      `  description = excluded.description, emoji = excluded.emoji, lesson_size = excluded.lesson_size, lesson_titles = excluded.lesson_titles;`,
      '',
      `insert into public.pack_items (pack_id, position, lesson, input, hint, status, lemma, normalized_lemma, pos, cefr, primary_meaning, content)`,
      `select p.id, v.position, v.lesson, v.input, v.hint, 'ready', v.lemma, v.normalized_lemma, v.pos, v.cefr, v.primary_meaning, v.content::jsonb`,
      `from public.packs p, (values`,
      pack.items
        .map((i) => `  (${i.position}, ${i.lesson}, ${q(i.input)}, ${q(i.hint)}, ${q(i.lemma)}, ${q(i.normalized_lemma)}, ${q(i.pos)}, ${q(i.cefr)}, ${q(i.primary_meaning)}, ${q(JSON.stringify(i.content))})`)
        .join(',\n'),
      `) as v (position, lesson, input, hint, lemma, normalized_lemma, pos, cefr, primary_meaning, content)`,
      `where p.slug = ${q(pack.slug)}`,
      `on conflict (pack_id, position) do update set lesson = excluded.lesson, input = excluded.input, hint = excluded.hint, status = 'ready',`,
      `  lemma = excluded.lemma, normalized_lemma = excluded.normalized_lemma, pos = excluded.pos, cefr = excluded.cefr,`,
      `  primary_meaning = excluded.primary_meaning, content = excluded.content;`,
      '',
      `delete from public.pack_items i using public.packs p where p.id = i.pack_id and p.slug = ${q(pack.slug)} and i.position >= ${pack.items.length};`,
      '',
    )
  }
  return out.join('\n')
}
