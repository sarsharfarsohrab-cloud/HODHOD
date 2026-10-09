/** Speech synthesis built into the browser / operating system. Free, instant, works offline on most phones. */
import type { AudioProvider, SpeakRequest } from './audio.ts'

/** Higher is better. Enhanced/premium system voices sound far more natural than the compact ones. */
function score(voice: SpeechSynthesisVoice, lang: string): number {
  const voiceLang = voice.lang.replace('_', '-').toLowerCase()
  const wanted = lang.toLowerCase()
  if (!voiceLang.startsWith(wanted.slice(0, 2))) return -1
  let s = voiceLang === wanted ? 20 : 10
  if (/premium|enhanced|natural|neural|siri/i.test(voice.name)) s += 8
  if (/google|microsoft/i.test(voice.name)) s += 4
  if (/compact|eloquence|espeak/i.test(voice.name)) s -= 6
  if (voice.localService) s += 1
  return s
}

export class BrowserSpeechProvider implements AudioProvider {
  readonly id = 'browser-speech'
  private voices: SpeechSynthesisVoice[] = []
  private readonly synth: SpeechSynthesis | null

  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
    if (!this.synth) return
    const load = () => {
      this.voices = this.synth!.getVoices()
    }
    load()
    // Voices arrive asynchronously in most browsers.
    this.synth.addEventListener?.('voiceschanged', load)
  }

  private pick(lang: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && this.synth) this.voices = this.synth.getVoices()
    let best: SpeechSynthesisVoice | null = null
    let bestScore = 0
    for (const voice of this.voices) {
      const s = score(voice, lang)
      if (s > bestScore) {
        best = voice
        bestScore = s
      }
    }
    return best
  }

  canSpeak(lang: string): boolean {
    if (!this.synth) return false
    // Before the voice list has loaded we cannot know; assume yes and let speak() decide.
    return this.voices.length === 0 || this.pick(lang) !== null
  }

  speak({ text, lang, rate }: SpeakRequest): Promise<void> {
    const synth = this.synth
    if (!synth) return Promise.reject(new Error('speech synthesis unavailable'))
    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)
      const voice = this.pick(lang)
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? lang
      utterance.rate = Math.min(1.5, Math.max(0.5, rate))
      utterance.onend = () => resolve()
      utterance.onerror = (event) => (event.error === 'canceled' || event.error === 'interrupted' ? resolve() : reject(new Error(event.error)))
      synth.cancel() // iOS queues utterances; a new tap should replace the old one
      synth.speak(utterance)
    })
  }

  stop(): void {
    this.synth?.cancel()
  }
}
