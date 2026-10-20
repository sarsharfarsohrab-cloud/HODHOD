/**
 * Listening to the learner (Web Speech API). Chrome and Safari (iOS 14.5+) offer it;
 * where it is missing or the microphone is refused, the speaking quiz falls back to
 * self-checking.
 */

interface RecognitionResultList {
  length: number
  [index: number]: { length: number; [index: number]: { transcript: string } }
}

interface Recognizer {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: RecognitionResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognizerClass = new () => Recognizer

function recognizerClass(): RecognizerClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && recognizerClass() !== null
}

export type ListenOutcome = { ok: true; heard: string[] } | { ok: false; reason: 'unsupported' | 'denied' | 'nothing' | 'failed' }

export interface Listening {
  result: Promise<ListenOutcome>
  stop(): void
}

/** Listens for one utterance; resolves with the recogniser's guesses (best first). */
export function listenOnce(lang = 'de-DE', timeoutMs = 8_000): Listening {
  const Recognition = recognizerClass()
  if (!Recognition) return { result: Promise.resolve({ ok: false, reason: 'unsupported' }), stop: () => {} }
  const recognizer = new Recognition()
  recognizer.lang = lang
  recognizer.interimResults = false
  recognizer.continuous = false
  recognizer.maxAlternatives = 5
  let settle: (outcome: ListenOutcome) => void = () => {}
  let done = false
  const result = new Promise<ListenOutcome>((resolve) => {
    settle = (outcome) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(outcome)
    }
  })
  const timer = setTimeout(() => {
    recognizer.stop()
    settle({ ok: false, reason: 'nothing' })
  }, timeoutMs)
  recognizer.onresult = (event) => {
    const heard: string[] = []
    for (let i = 0; i < event.results.length; i++) {
      const alternatives = event.results[i]!
      for (let j = 0; j < alternatives.length; j++) {
        const text = alternatives[j]!.transcript.trim()
        if (text && !heard.includes(text)) heard.push(text)
      }
    }
    settle(heard.length ? { ok: true, heard } : { ok: false, reason: 'nothing' })
  }
  recognizer.onerror = (event) => {
    const reason = event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : event.error === 'no-speech' ? 'nothing' : 'failed'
    settle({ ok: false, reason })
  }
  recognizer.onend = () => settle({ ok: false, reason: 'nothing' })
  try {
    recognizer.start()
  } catch {
    settle({ ok: false, reason: 'failed' })
  }
  return {
    result,
    stop: () => {
      try {
        recognizer.stop()
      } catch {
        // already stopped
      }
    },
  }
}
