/**
 * Quiz questions built from the learner's own Word Bank — no AI call, works offline.
 *
 * A quiz is separate from spaced repetition: answers are stored as quiz history and
 * never move a card. They only influence which words later quizzes prefer.
 */
import { isDifficult } from './cards.ts'
import { foldGerman, foldGermanLoose, foldPersian } from './text.ts'
import type { Card, Word } from './types.ts'

export type QuestionType = 'choice_de_fa' | 'choice_fa_de' | 'typing_fa_de' | 'article'
export type QuizKind = 'mixed' | 'choice' | 'typing' | 'article'

export const QUIZ_LENGTHS = [5, 10, 20] as const
export const DEFAULT_QUIZ_LENGTH = 10
export const CHOICE_OPTIONS = 4
const ARTICLES = ['der', 'die', 'das'] as const

export interface Question {
  type: QuestionType
  wordId: string
  /** What is shown as the question. */
  prompt: string
  promptLanguage: 'de' | 'fa'
  /** Buttons to choose from; null for typed answers. */
  options: { label: string; language: 'de' | 'fa' }[] | null
  /** The answer as it is shown in feedback. */
  expected: string
}

export interface WordQuizStat {
  attempts: number
  wrong: number
  lastAnswered: string | null
}

export interface QuizCandidate {
  word: Word
  card: Card | undefined
  stat: WordQuizStat | undefined
}

/** Returns a number in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number

const display = (word: Word) => (word.content.noun?.article ? `${word.content.noun.article} ${word.lemma}` : word.lemma)
const hasArticle = (word: Word) => word.pos === 'noun' && Boolean(word.content.noun?.article) && !word.content.noun?.pluralOnly

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * How much a word should be favoured: words being learned, words that were forgotten
 * or answered wrongly, and words not quizzed lately come up more often. Words not yet
 * started in flashcards are possible but rare — a quiz is for what has been studied.
 */
export function quizWeight(candidate: QuizCandidate, now: Date): number {
  const { card, stat } = candidate
  let weight = 1
  if (!card || card.state === 'new') weight = 0.3
  else if (card.state === 'learning' || card.state === 'relearning') weight += 2
  if (isDifficult(card)) weight += 1.5
  if (stat && stat.attempts > 0) weight += 3 * (stat.wrong / stat.attempts)
  const last = stat?.lastAnswered ? new Date(stat.lastAnswered).getTime() : 0
  if (now.getTime() - last > 7 * 86_400_000) weight += 1
  return weight
}

/** Picks up to `count` different candidates, likelier ones first, without repeats. */
export function pickWeighted(candidates: readonly QuizCandidate[], count: number, now: Date, rng: Rng): QuizCandidate[] {
  const pool = candidates.map((candidate) => ({ candidate, weight: quizWeight(candidate, now) }))
  const out: QuizCandidate[] = []
  while (out.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
    let roll = rng() * total
    let index = pool.findIndex((entry) => (roll -= entry.weight) < 0)
    if (index < 0) index = pool.length - 1
    out.push(pool[index]!.candidate)
    pool.splice(index, 1)
  }
  return out
}

/** Which kinds of quiz the current Word Bank can support, and why not otherwise. */
export function quizAvailability(words: readonly Word[]): Record<QuizKind, boolean> {
  const meanings = new Set(words.map((w) => foldPersian(w.primaryMeaning)))
  const choice = words.length >= CHOICE_OPTIONS && meanings.size >= CHOICE_OPTIONS
  const article = words.some(hasArticle)
  const typing = words.length >= 1
  return { choice, article, typing, mixed: typing }
}

function distractors(target: Word, all: readonly Word[], key: (w: Word) => string, label: (w: Word) => string, rng: Rng): string[] | null {
  const taken = new Set([key(target)])
  const out: string[] = []
  // same part of speech first: "Tisch / Lampe / Stuhl" is a fairer choice than "Tisch / schnell / gehen"
  const ordered = [...shuffle(all.filter((w) => w.pos === target.pos), rng), ...shuffle(all.filter((w) => w.pos !== target.pos), rng)]
  for (const word of ordered) {
    if (word.id === target.id || taken.has(key(word))) continue
    taken.add(key(word))
    out.push(label(word))
    if (out.length === CHOICE_OPTIONS - 1) return out
  }
  return null
}

export function buildQuestion(type: QuestionType, word: Word, all: readonly Word[], rng: Rng): Question | null {
  switch (type) {
    case 'article':
      if (!hasArticle(word)) return null
      return {
        type, wordId: word.id, prompt: word.lemma, promptLanguage: 'de',
        options: ARTICLES.map((label) => ({ label, language: 'de' as const })),
        expected: word.content.noun!.article!,
      }
    case 'choice_de_fa': {
      const wrong = distractors(word, all, (w) => foldPersian(w.primaryMeaning), (w) => w.primaryMeaning, rng)
      if (!wrong) return null
      return {
        type, wordId: word.id, prompt: display(word), promptLanguage: 'de',
        options: shuffle([word.primaryMeaning, ...wrong], rng).map((label) => ({ label, language: 'fa' as const })),
        expected: word.primaryMeaning,
      }
    }
    case 'choice_fa_de': {
      const wrong = distractors(word, all, (w) => foldGerman(w.lemma), display, rng)
      if (!wrong) return null
      return {
        type, wordId: word.id, prompt: word.primaryMeaning, promptLanguage: 'fa',
        options: shuffle([display(word), ...wrong], rng).map((label) => ({ label, language: 'de' as const })),
        expected: display(word),
      }
    }
    case 'typing_fa_de':
      return { type, wordId: word.id, prompt: word.primaryMeaning, promptLanguage: 'fa', options: null, expected: display(word) }
  }
}

const TYPES_BY_KIND: Record<QuizKind, QuestionType[]> = {
  article: ['article'],
  choice: ['choice_de_fa', 'choice_fa_de'],
  typing: ['typing_fa_de'],
  mixed: ['choice_de_fa', 'choice_fa_de', 'typing_fa_de', 'article'],
}

/** Builds a quiz of up to `length` questions, each about a different word. */
export function buildQuiz(kind: QuizKind, candidates: readonly QuizCandidate[], length: number, now: Date, rng: Rng): Question[] {
  const words = candidates.map((c) => c.word)
  const eligible = kind === 'article' ? candidates.filter((c) => hasArticle(c.word)) : candidates
  const questions: Question[] = []
  // ask for more words than needed: some cannot form the wanted question type
  for (const candidate of pickWeighted(eligible, eligible.length, now, rng)) {
    if (questions.length === length) break
    for (const type of shuffle(TYPES_BY_KIND[kind], rng)) {
      const question = buildQuestion(type, candidate.word, words, rng)
      if (question) {
        questions.push(question)
        break
      }
    }
  }
  return questions
}

// ---------------------------------------------------------------------------
// grading
// ---------------------------------------------------------------------------

export type GradeNote =
  /** right word, capitalisation differs (nouns are capitalised in German) */
  | 'case'
  /** right word, written without umlaut/ß (ae, oe, ue, ss) */
  | 'spelling'
  /** right noun, wrong der/die/das */
  | 'wrong_article'

export interface Grade {
  correct: boolean
  note: GradeNote | null
}

const squeeze = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim()

/**
 * Grades a typed German answer. Small slips that do not show a gap in knowledge
 * (capitalisation, ae for ä) are accepted and pointed out; a wrong article is a real mistake.
 */
export function gradeTyped(input: string, word: Word): Grade {
  const answer = squeeze(input)
  if (!answer) return { correct: false, note: null }
  const article = hasArticle(word) ? word.content.noun!.article! : null

  let body = answer
  let givenArticle: string | null = null
  const first = answer.split(' ')[0]!.toLowerCase()
  if (article && answer.includes(' ') && (ARTICLES as readonly string[]).includes(first)) {
    givenArticle = first
    body = answer.slice(first.length + 1)
  }

  let note: GradeNote | null = null
  if (body !== word.lemma) {
    if (body.toLocaleLowerCase('de') === word.lemma.toLocaleLowerCase('de')) note = 'case'
    else if (foldGermanLoose(body) === foldGermanLoose(word.lemma)) note = 'spelling'
    else return { correct: false, note: null }
  }
  if (givenArticle && givenArticle !== article) return { correct: false, note: 'wrong_article' }
  return { correct: true, note }
}

export function gradeChoice(choice: string, question: Question): Grade {
  return { correct: choice === question.expected, note: null }
}

export interface QuizAnswer {
  question: Question
  answer: string
  correct: boolean
  note: GradeNote | null
  durationMs: number
  answeredAt: string
}

export interface QuizSummary {
  total: number
  correct: number
  accuracy: number
  /** Words answered wrongly, each once, in the order they came up. */
  missedWordIds: string[]
}

export function summarize(answers: readonly QuizAnswer[]): QuizSummary {
  const correct = answers.filter((a) => a.correct).length
  const missed: string[] = []
  for (const a of answers) if (!a.correct && !missed.includes(a.question.wordId)) missed.push(a.question.wordId)
  return { total: answers.length, correct, accuracy: answers.length ? correct / answers.length : 0, missedWordIds: missed }
}
