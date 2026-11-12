/**
 * The short practice of a pack group: words and meanings only, never the example sentences.
 * It is a warm-up before the cards join the review — nothing here touches the schedule.
 */

export interface PracticeEntry {
  id: string
  /** the word as shown, with its article ("der Tisch") */
  word: string
  meaning: string
}

export type PracticeKind = 'meaning' | 'word' | 'listen'

export interface PracticeQuestion {
  kind: PracticeKind
  /** the entry asked about */
  entry: PracticeEntry
  /** the choices, the right one among them */
  options: PracticeEntry[]
}

const shuffled = <T>(list: readonly T[], random: () => number): T[] => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * One question per word, in a mixed order:
 *   meaning — the word is shown, its meaning is chosen
 *   word    — the meaning is shown, the word is chosen
 *   listen  — the word is heard (not shown), the word is chosen
 * Wrong choices come from the same group and never share the right answer's word or meaning.
 */
export function buildPractice(entries: readonly PracticeEntry[], random: () => number = Math.random, choices = 3): PracticeQuestion[] {
  if (entries.length < 2) return []
  const kinds: PracticeKind[] = ['meaning', 'word', 'listen']
  return shuffled(entries, random).map((entry, i) => {
    const others = shuffled(
      entries.filter((e) => e.id !== entry.id && e.word !== entry.word && e.meaning !== entry.meaning),
      random,
    ).slice(0, Math.max(1, choices - 1))
    return { kind: kinds[i % kinds.length]!, entry, options: shuffled([entry, ...others], random) }
  })
}
