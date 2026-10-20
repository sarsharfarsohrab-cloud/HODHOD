/**
 * Pronunciation audio behind one interface, so the source of the sound can change
 * (device voice today, server-generated audio later) without touching any screen.
 */
export interface SpeakRequest {
  text: string
  /** BCP-47 language of the text, e.g. "de-DE". */
  lang: string
  /** 1 = normal speed. */
  rate: number
}

export interface AudioProvider {
  readonly id: string
  /** True when this provider can pronounce the language on this device right now. */
  canSpeak(lang: string): boolean
  speak(request: SpeakRequest): Promise<void>
  stop(): void
  /** Optional: get the sound ready before it is asked for. */
  prefetch?(text: string): void
}

export const LANGUAGE_TAGS: Record<string, string> = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', fa: 'fa-IR' }

/** Tries providers in order; when one fails (offline, no credit), the next one speaks instead. */
export class AudioPlayer {
  private active: AudioProvider | null = null
  constructor(private readonly providers: readonly AudioProvider[]) {}

  canSpeak(languageCode: string): boolean {
    const lang = LANGUAGE_TAGS[languageCode] ?? languageCode
    return this.providers.some((p) => p.canSpeak(lang))
  }

  private generation = 0

  async speak(text: string, languageCode: string, rate: number): Promise<boolean> {
    const lang = LANGUAGE_TAGS[languageCode] ?? languageCode
    if (!text.trim()) return false
    this.stop()
    const run = ++this.generation
    for (const provider of this.providers) {
      if (!provider.canSpeak(lang)) continue
      this.active = provider
      try {
        await provider.speak({ text, lang, rate })
        return true
      } catch {
        // try the next provider, unless something else started playing meanwhile
        if (run !== this.generation) return false
      } finally {
        if (this.active === provider) this.active = null
      }
    }
    return false
  }

  /** Prepares the sound for a text that is likely to be played soon. */
  prefetch(text: string, languageCode: string): void {
    const lang = LANGUAGE_TAGS[languageCode] ?? languageCode
    this.providers.find((p) => p.canSpeak(lang))?.prefetch?.(text)
  }

  stop(): void {
    this.generation++
    this.active?.stop()
    this.active = null
  }
}
