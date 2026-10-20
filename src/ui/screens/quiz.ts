/**
 * Quiz: questions built from the learner's own words (see core/quiz.ts).
 * Answers are stored as quiz history and never change a card's schedule.
 */
import {
  buildQuiz,
  DEFAULT_QUIZ_LENGTH,
  gradeChoice,
  gradeDictation,
  gradeSpoken,
  gradeTyped,
  QUIZ_LENGTHS,
  quizAvailability,
  summarize,
  type Grade,
  type Question,
  type QuizAnswer,
  type QuizCandidate,
  type QuizKind,
} from '../../core/quiz.ts'
import { listenOnce, speechRecognitionSupported, type Listening } from '../../audio/recognition.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { faPercent } from '../format.ts'
import { burst, mascot, reactMascot, setMascotMood } from '../mascot.ts'
import { t } from '../strings.ts'
import { emptyState, iconButton, progressBar, segmented, speakButton, wordTitle } from '../widgets.ts'

const KINDS: QuizKind[] = ['mixed', 'choice', 'typing', 'article', 'listening', 'speaking']
const GREAT = 0.9
const GOOD = 0.6

/** Remembered between visits so the next quiz starts the way the last one was set up. */
let lastSetup: { kind: QuizKind; length: number } = { kind: 'mixed', length: DEFAULT_QUIZ_LENGTH }

export function quizScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const el = h('main', { class: 'screen' })
  const bird = mascot('idle', { size: 76, enter: 'hop' })
  let kind: QuizKind = KINDS.includes(params.kind as QuizKind) ? (params.kind as QuizKind) : lastSetup.kind
  let length = lastSetup.length
  let questions: Question[] = []
  let answers: QuizAnswer[] = []
  let index = 0
  let startedAt = ctx.now()
  let shownAt = 0
  let running = false
  let saved = false
  let onKey: ((event: KeyboardEvent) => void) | null = null

  const setKeys = (handler: ((event: KeyboardEvent) => void) | null) => {
    if (onKey) document.removeEventListener('keydown', onKey)
    onKey = handler
    if (handler) document.addEventListener('keydown', handler)
  }

  const candidates = (): QuizCandidate[] =>
    [...ctx.data.words.values()].map((word) => ({ word, card: ctx.data.cards.get(word.id), stat: ctx.data.quizStats.get(word.id) }))

  /** Stores what was answered — also when the learner leaves half-way. */
  async function save() {
    if (saved || answers.length === 0) return
    saved = true
    await ctx.data.recordQuiz(kind, startedAt, answers)
  }

  // --- setup -----------------------------------------------------------------------

  function renderSetup() {
    setKeys(null)
    running = false
    const words = [...ctx.data.words.values()]
    const available = quizAvailability(words)
    // hearing and speaking need a German voice on this device (the AI voice or the phone's)
    const sound = ctx.audio.canSpeak(ctx.data.profile.activeTargetLanguage)
    available.listening &&= sound
    available.speaking &&= sound
    if (!available[kind]) kind = KINDS.find((k) => available[k]) ?? 'mixed'
    const reason: Partial<Record<QuizKind, string>> = { choice: t.quiz.needFour, article: t.quiz.needNouns, ...(sound ? {} : { listening: t.quiz.needSound, speaking: t.quiz.needSound }) }

    if (words.length === 0) {
      return replace(
        el,
        h('header', { class: 'topbar' }, h('h1', null, t.quiz.title)),
        emptyState({ art: mascot('idle', { size: 132 }), title: t.quiz.needWords, action: h('a', { class: 'btn primary', href: '#/create' }, icon('plus'), t.home.addWord) }),
      )
    }

    replace(
      el,
      h('header', { class: 'topbar' }, h('h1', null, t.quiz.title)),
      h('div', { class: 'hello' }, mascot('teacher', { size: 128, enter: 'fly' }), h('p', { class: 'bubble' }, t.quiz.intro)),
      h(
        'section',
        { class: 'card stack' },
        h(
          'div',
          { class: 'option-grid', role: 'radiogroup', 'aria-label': t.quiz.title },
          KINDS.map((k) =>
            h(
              'button',
              {
                class: 'option-card', type: 'button', role: 'radio', 'aria-checked': String(k === kind), disabled: !available[k],
                onclick: () => { kind = k; renderSetup() },
              },
              h('b', { class: k === 'article' ? 'de' : '' }, t.quiz.kinds[k].title),
              h('span', null, available[k] ? t.quiz.kinds[k].body : reason[k] ?? t.quiz.needWords),
            ),
          ),
        ),
        h('span', { class: 'label' }, t.quiz.length),
        segmented(QUIZ_LENGTHS.map((n) => ({ value: String(n), label: t.quiz.questions(n) })), String(length), (value) => (length = Number(value)), t.quiz.length),
        h('button', { class: 'btn primary big block', type: 'button', disabled: !available[kind], onclick: start }, icon('quiz'), t.quiz.start),
      ),
    )
  }

  function start() {
    lastSetup = { kind, length }
    questions = buildQuiz(kind, candidates(), length, ctx.now(), Math.random)
    if (questions.length === 0) return ctx.toast(t.quiz.needWords, 'error')
    answers = []
    index = 0
    saved = false
    startedAt = ctx.now()
    running = true
    setMascotMood(bird, 'idle')
    renderQuestion()
  }

  // --- one question ----------------------------------------------------------------

  const topBar = () =>
    h(
      'header',
      { class: 'study-top' },
      iconButton('close', t.quiz.exit, () => void leave()),
      h('div', { class: 'grow' }, progressBar(index / questions.length, t.quiz.position(index + 1, questions.length))),
      h('span', { class: 'small muted' }, t.quiz.position(index + 1, questions.length)),
    )

  const promptBlock = (question: Question) =>
    h(
      'div',
      { class: 'flashcard-front' },
      h('p', { class: 'small muted' }, t.quiz.prompts[question.type]),
      question.promptLanguage === 'de' ? de(question.prompt, 'word-title') : h('div', { class: 'meaning-title', style: { fontSize: 'var(--text-xl)' } }, question.prompt),
    )

  const say = (text: string, slow = false) =>
    void ctx.audio.speak(text, ctx.data.profile.activeTargetLanguage, slow ? Math.max(0.5, ctx.data.settings.speechRate * 0.7) : ctx.data.settings.speechRate)

  let listening: Listening | null = null

  /** Listening: the text is only heard, then written down. */
  function renderDictation(question: Question) {
    const word = ctx.data.words.get(question.wordId)
    const input = h('input', {
      class: 'input create-input', type: 'text', lang: 'de', dir: 'ltr', placeholder: t.quiz.typePlaceholder, 'aria-label': t.quiz.typePlaceholder,
      autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: false, enterKeyHint: 'done', maxLength: 240,
    })
    const submit = (value: string) => answer(value.trim(), word ? gradeDictation(value, word) : { correct: false, note: null })
    const prompt = h(
      'div',
      { class: 'flashcard-front' },
      h('p', { class: 'small muted' }, t.quiz.prompts.dictation),
      h(
        'div',
        { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'play-big', type: 'button', 'aria-label': t.quiz.listen, onclick: () => say(question.prompt) }, icon('speaker', { size: 40 })),
        h('button', { class: 'btn small', type: 'button', onclick: () => say(question.prompt, true) }, t.quiz.listenSlow),
      ),
    )
    replace(
      el,
      topBar(),
      h('div', { class: 'companion' }, bird),
      h('article', { class: 'flashcard quiz-card' }, prompt),
      h(
        'form',
        { class: 'stack', onsubmit: (e: Event) => { e.preventDefault(); submit(input.value) } },
        input,
        h('p', { class: 'help' }, t.quiz.dictationHelp),
        h('div', { class: 'row' }, h('button', { class: 'btn big', type: 'button', onclick: () => submit('') }, t.quiz.dontKnow), h('button', { class: 'btn accent big grow', type: 'submit' }, t.quiz.check)),
      ),
    )
    setKeys(null)
    say(question.prompt)
    queueMicrotask(() => input.focus({ preventScroll: true }))
  }

  /** Speaking: say it out loud; the recogniser listens, or the learner judges themselves. */
  function renderSpeaking(question: Question, selfCheck = !speechRecognitionSupported(), status: string | null = null) {
    const word = ctx.data.words.get(question.wordId)
    const prompt = h(
      'div',
      { class: 'flashcard-front' },
      h('p', { class: 'small muted' }, t.quiz.prompts.speaking),
      word ? wordTitle(word.content, 'div') : de(question.prompt, 'word-title'),
      word ? h('p', { class: 'muted' }, word.primaryMeaning) : null,
      h('button', { class: 'btn small', type: 'button', onclick: () => say(question.prompt) }, icon('speaker', { size: 16 }), t.quiz.listen),
    )
    let controls: HTMLElement
    if (selfCheck) {
      controls = h(
        'div',
        { class: 'stack' },
        h('p', { class: 'help' }, status ?? t.quiz.selfCheckHelp),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn big grow', type: 'button', onclick: () => answer('', { correct: false, note: null }) }, t.quiz.selfNo),
          h('button', { class: 'btn accent big grow', type: 'button', onclick: () => answer('', { correct: true, note: null }) }, icon('check'), t.quiz.selfYes),
        ),
      )
    } else {
      const mic = h('button', { class: 'mic-big', type: 'button', 'aria-label': t.quiz.speakNow }, icon('mic', { size: 40 }))
      const line = h('p', { class: 'help center', role: 'status' }, status ?? t.quiz.speakingHelp)
      mic.onclick = async () => {
        if (listening) return
        ctx.audio.stop()
        mic.classList.add('on')
        line.textContent = t.quiz.listening
        listening = listenOnce(`${ctx.data.profile.activeTargetLanguage === 'de' ? 'de-DE' : ctx.data.profile.activeTargetLanguage}`)
        const outcome = await listening.result
        listening = null
        mic.classList.remove('on')
        if (!el.isConnected || questions[index] !== question) return
        if (outcome.ok) return answer(outcome.heard[0]!, word ? gradeSpoken(outcome.heard, word) : { correct: false, note: null })
        if (outcome.reason === 'nothing') line.textContent = t.quiz.heardNothing
        else renderSpeaking(question, true, outcome.reason === 'denied' ? t.quiz.micDenied : t.quiz.selfCheckHelp)
      }
      controls = h(
        'div',
        { class: 'stack', style: { alignItems: 'center' } },
        mic,
        line,
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => answer('', { correct: false, note: null }) }, t.quiz.dontKnow),
      )
    }
    replace(el, topBar(), h('div', { class: 'companion' }, bird), h('article', { class: 'flashcard quiz-card' }, prompt), controls)
    setKeys(null)
  }

  function renderQuestion() {
    const question = questions[index]!
    shownAt = Date.now()
    if (question.type === 'dictation') return renderDictation(question)
    if (question.type === 'speaking') return renderSpeaking(question)
    let body: HTMLElement
    if (question.options) {
      const options = question.options
      body = h(
        'div',
        { class: `quiz-options ${question.type === 'article' ? 'articles' : ''}`, role: 'group', 'aria-label': t.quiz.prompts[question.type] },
        options.map((option) =>
          h(
            'button',
            { class: `quiz-option ${question.type === 'article' ? `article-${option.label}` : ''}`, type: 'button', onclick: () => answer(option.label, gradeChoice(option.label, question)) },
            option.language === 'de' ? de(option.label) : option.label,
          ),
        ),
      )
      setKeys((event) => {
        const n = Number(event.key)
        if (!event.metaKey && !event.ctrlKey && n >= 1 && n <= options.length) {
          event.preventDefault()
          answer(options[n - 1]!.label, gradeChoice(options[n - 1]!.label, question))
        }
      })
    } else {
      const word = ctx.data.words.get(question.wordId)
      const input = h('input', {
        class: 'input create-input', type: 'text', lang: 'de', dir: 'ltr', placeholder: t.quiz.typePlaceholder, 'aria-label': t.quiz.typePlaceholder,
        autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: false, enterKeyHint: 'done', maxLength: 80,
      })
      const submit = (value: string) => answer(value.trim(), word ? gradeTyped(value, word) : { correct: false, note: null })
      body = h(
        'form',
        { class: 'stack', onsubmit: (e: Event) => { e.preventDefault(); submit(input.value) } },
        input,
        h('p', { class: 'help' }, t.quiz.typeHelp),
        h('div', { class: 'row' }, h('button', { class: 'btn big', type: 'button', onclick: () => submit('') }, t.quiz.dontKnow), h('button', { class: 'btn accent big grow', type: 'submit' }, t.quiz.check)),
      )
      setKeys(null)
      queueMicrotask(() => input.focus())
    }
    replace(el, topBar(), h('div', { class: 'companion' }, bird), h('article', { class: 'flashcard quiz-card' }, promptBlock(question)), body)
    window.scrollTo({ top: 0 })
  }

  function answer(given: string, grade: Grade) {
    listening?.stop()
    listening = null
    const question = questions[index]!
    if (answers.length > index) return // a double tap on an option
    answers.push({ question, answer: given, correct: grade.correct, note: grade.note, durationMs: Math.min(120_000, Date.now() - shownAt), answeredAt: ctx.now().toISOString() })
    renderFeedback(question, given, grade)
    reactMascot(bird, grade.correct ? (grade.note ? 'encouraging' : 'happy') : 'supportive', 'idle', 2200)
    if (grade.correct) burst(bird, grade.note ? 'sparks' : 'hearts', 7)
  }

  function renderFeedback(question: Question, given: string, grade: Grade) {
    const word = ctx.data.words.get(question.wordId)
    const lastOne = index === questions.length - 1
    const next = () => {
      index++
      if (index < questions.length) renderQuestion()
      else void finish()
    }
    const nextButton = h('button', { class: 'btn primary big block', type: 'button', onclick: next }, lastOne ? t.quiz.finish : t.quiz.next)

    const options = question.options
      ? h(
          'div',
          { class: `quiz-options ${question.type === 'article' ? 'articles' : ''}` },
          question.options.map((option) => {
            const state = option.label === question.expected ? 'correct' : option.label === given ? 'wrong' : 'other'
            return h(
              'div',
              { class: `quiz-option is-${state}`, 'aria-label': state === 'correct' ? `${option.label} — ${t.quiz.answerIs}` : undefined },
              state === 'correct' ? icon('check', { size: 18 }) : state === 'wrong' ? icon('close', { size: 18 }) : null,
              option.language === 'de' ? de(option.label) : option.label,
            )
          }),
        )
      : given
        ? h('p', { class: 'muted', style: { textAlign: 'center' } }, question.type === 'speaking' ? t.quiz.heard(given) : de(given))
        : null

    const message = grade.note ? t.quiz.notes[grade.note] : grade.correct ? t.quiz.correct : t.quiz.wrong
    replace(
      el,
      topBar(),
      h('div', { class: 'companion' }, bird, h('p', { class: `bubble ${grade.correct ? 'ok' : 'no'}`, role: 'status' }, message)),
      h(
        'article',
        { class: 'flashcard quiz-card revealed' },
        promptBlock(question),
        word
          ? h(
              'div',
              { class: 'flashcard-back' },
              h('p', { class: 'small muted', style: { textAlign: 'center' } }, t.quiz.answerIs),
              h('div', { class: 'row', style: { justifyContent: 'center' } }, wordTitle(word.content, 'div'), speakButton(ctx, question.expected.includes(' ') ? question.expected : word.lemma)),
              h('p', { style: { textAlign: 'center', fontWeight: '700' } }, word.primaryMeaning),
            )
          : null,
      ),
      options,
      nextButton,
    )
    setKeys((event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        next()
      }
    })
    nextButton.focus({ preventScroll: true })
  }

  // --- result ------------------------------------------------------------------------

  async function finish() {
    setKeys(null)
    running = false
    await save()
    const summary = summarize(answers)
    const mood = summary.accuracy >= GREAT ? 'celebrating' : summary.accuracy >= GOOD ? 'happy' : 'supportive'
    const line = summary.accuracy >= GREAT ? t.quiz.resultGreat : summary.accuracy >= GOOD ? t.quiz.resultGood : t.quiz.resultKeepGoing
    const missed = summary.missedWordIds.map((id) => ctx.data.words.get(id)).filter((w) => w !== undefined)
    replace(
      el,
      emptyState({
        art: mascot(mood, { size: 140 }),
        title: t.quiz.resultTitle,
        body: line,
        action: h(
          'div',
          { class: 'stack', style: { width: '100%', alignItems: 'stretch' } },
          h(
            'div',
            { class: 'summary-grid' },
            h('div', { class: 'plan-number' }, h('b', null, t.quiz.score(summary.correct, summary.total)), h('span', null, t.quiz.correctLabel)),
            h('div', { class: 'plan-number' }, h('b', null, faPercent(summary.accuracy)), h('span', null, t.quiz.accuracyLabel)),
          ),
        ),
      }),
      missed.length
        ? h(
            'section',
            { class: 'card stack' },
            h('h2', null, t.quiz.missed),
            h(
              'ul',
              { class: 'word-list flat' },
              missed.map((word) => h('li', { class: 'word-row' }, h('a', { href: `#/words/${word.id}` }, wordTitle(word.content, 'span', 'de'), h('span', { class: 'meaning-line' }, word.primaryMeaning)))),
            ),
            h('p', { class: 'help' }, t.quiz.studyHint),
          )
        : null,
      h('button', { class: 'btn primary big block', type: 'button', onclick: renderSetup }, icon('refresh'), t.quiz.again),
      h('a', { class: 'btn block', href: '#/home' }, t.study.doneHome),
    )
    window.scrollTo({ top: 0 })
  }

  async function leave() {
    if (answers.length > 0 && !(await ctx.confirm({ title: t.quiz.exit, body: t.quiz.exitConfirm, confirmLabel: t.quiz.exit }))) return
    await save()
    renderSetup()
  }

  renderSetup()
  return {
    el,
    destroy() {
      setKeys(null)
      listening?.stop()
      ctx.audio.stop()
      if (running) void save()
    },
  }
}
