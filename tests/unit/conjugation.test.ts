import { describe, expect, test } from 'bun:test'
import { bareInfinitive, buildConjugation, spokenForm } from '../../src/core/conjugation.ts'
import type { VerbInfo } from '../../supabase/functions/_shared/wordSchema.ts'
import { AUFGEBEN } from '../fixtures/words.ts'

const forms = (lemma: string, verb: VerbInfo, key: string) =>
  buildConjugation(lemma, verb)
    .find((t) => t.key === key)!
    .rows.map((r) => r.form)

const GEHEN: VerbInfo = {
  separable: false, auxiliary: 'sein', reflexive: 'none', irregular: true, partizip2: 'gegangen', government: null,
  praesens: ['gehe', 'gehst', 'geht', 'gehen', 'geht', 'gehen'],
  praeteritum: ['ging', 'gingst', 'ging', 'gingen', 'gingt', 'gingen'],
  konjunktiv1: ['gehe', 'gehest', 'gehe', 'gehen', 'gehet', 'gehen'],
  konjunktiv2: ['ginge', 'gingest', 'ginge', 'gingen', 'ginget', 'gingen'],
  imperativ: { du: 'Geh!', ihr: 'Geht!', Sie: 'Gehen Sie!' },
}
const FREUEN: VerbInfo = {
  ...GEHEN, auxiliary: 'haben', reflexive: 'accusative', irregular: false, partizip2: 'gefreut',
  praesens: ['freue mich', 'freust dich', 'freut sich', 'freuen uns', 'freut euch', 'freuen sich'],
}

describe('conjugation table', () => {
  test('has the nine tenses in a stable order', () => {
    expect(buildConjugation('aufgeben', AUFGEBEN.verb!).map((t) => t.title)).toEqual([
      'Präsens', 'Präteritum', 'Perfekt', 'Plusquamperfekt', 'Futur I', 'Futur II', 'Konjunktiv I', 'Konjunktiv II', 'Imperativ',
    ])
  })
  test('separable verb with haben', () => {
    const v = AUFGEBEN.verb!
    expect(forms('aufgeben', v, 'perfekt')).toEqual(['habe aufgegeben', 'hast aufgegeben', 'hat aufgegeben', 'haben aufgegeben', 'habt aufgegeben', 'haben aufgegeben'])
    expect(forms('aufgeben', v, 'plusquamperfekt')[1]).toBe('hattest aufgegeben')
    expect(forms('aufgeben', v, 'futur1')).toEqual(['werde aufgeben', 'wirst aufgeben', 'wird aufgeben', 'werden aufgeben', 'werdet aufgeben', 'werden aufgeben'])
    expect(forms('aufgeben', v, 'futur2')[2]).toBe('wird aufgegeben haben')
  })
  test('verb of motion with sein', () => {
    expect(forms('gehen', GEHEN, 'perfekt')).toEqual(['bin gegangen', 'bist gegangen', 'ist gegangen', 'sind gegangen', 'seid gegangen', 'sind gegangen'])
    expect(forms('gehen', GEHEN, 'plusquamperfekt')[4]).toBe('wart gegangen')
    expect(forms('gehen', GEHEN, 'futur2')[0]).toBe('werde gegangen sein')
  })
  test('reflexive verb keeps its pronoun and drops "sich" from the infinitive', () => {
    expect(bareInfinitive('sich freuen')).toBe('freuen')
    expect(forms('sich freuen', FREUEN, 'perfekt')).toEqual(['habe mich gefreut', 'hast dich gefreut', 'hat sich gefreut', 'haben uns gefreut', 'habt euch gefreut', 'haben sich gefreut'])
    expect(forms('sich freuen', FREUEN, 'futur1')[0]).toBe('werde mich freuen')
    expect(forms('sich vorstellen', { ...FREUEN, reflexive: 'dative', partizip2: 'vorgestellt' }, 'perfekt')[1]).toBe('hast dir vorgestellt')
  })
  test('verbs without an imperative get no empty imperative section', () => {
    const modal = { ...GEHEN, imperativ: { du: '', ihr: '', Sie: '' } }
    expect(buildConjugation('können', modal).some((t) => t.key === 'imperativ')).toBe(false)
  })
  test('audio text includes one pronoun', () => {
    expect(spokenForm({ person: 'er/sie/es', form: 'gibt auf' })).toBe('er gibt auf')
    expect(spokenForm({ person: 'sie/Sie', form: 'geben auf' })).toBe('sie geben auf')
    expect(spokenForm({ person: '', form: 'Gib auf!' })).toBe('Gib auf!')
  })
})
