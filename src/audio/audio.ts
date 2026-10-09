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
}

export const LANGUAGE_TAGS: Record<string, string> = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', fa: 'fa-IR' }

/** Tries providers in order and uses the first that can speak the language. */
export class AudioPlayer {
  private active: AudioProvider | null = null
  constructor(private readonly providers: readonly AudioProvider[]) {}

  canSpeak(languageCode: string): boolean {
    const lang = LANGUAGE_TAGS[languageCode] ?? languageCode
    return this.providers.some((p) => p.canSpeak(lang))
  }

  async speak(text: string, languageCode: string, rate: number): Promise<boolean> {
    const lang = LANGUAGE_TAGS[languageCode] ?? languageCode
    const provider = this.providers.find((p) => p.canSpeak(lang))
    if (!provider || !text.trim()) return false
    this.stop()
    this.active = provider
    try {
      await provider.speak({ text, lang, rate })
      return true
    } catch {
      return false
    } finally {
      if (this.active === provider) this.active = null
    }
  }

  stop(): void {
    this.active?.stop()
    this.active = null
  }
}
