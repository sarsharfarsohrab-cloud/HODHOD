/**
 * Test mode (test.apphodhod.com): the whole app, but against a stand-in server that lives in
 * this browser tab. Nothing reaches the real database or the AI, nothing costs money, and
 * "Start over" wipes everything so the app can be tried again like a brand-new visitor.
 *
 * Loaded only on the test address (a separate file; the normal app never downloads it).
 */
import { aiResponse, FAKE_ANON_KEY, FakeSupabase } from '../../tests/fake-backend/fakeSupabase.ts'
import { asAiOutput, AUFGEBEN, SCHNELL, TISCH } from '../../tests/fixtures/words.ts'
import type { SupabaseConfig } from '../data/supabase.ts'
import { h } from '../ui/dom.ts'
import { currentLanguage } from '../ui/strings.ts'

const STATE_KEY = 'hodhod.demo.state'
const ORIGIN = 'https://demo.hodhod.test'
export const SAMPLE_EMAIL = 'learner@demo.hodhod'
export const SAMPLE_PASSWORD = 'hodhod-demo-learner'

const WORDS: Record<string, typeof TISCH> = { tisch: TISCH, 'der tisch': TISCH, aufgeben: AUFGEBEN, schnell: SCHNELL }

function makeBackend(): FakeSupabase {
  const fake = new FakeSupabase({ origin: ORIGIN, welcome: true })
  // the stand-in AI knows a few words; anything else answers like an AI that could not help
  fake.aiReply = (word) => {
    const known = WORDS[word.toLowerCase()]
    return known ? aiResponse(asAiOutput(known)) : aiResponse({ status: 'not_a_word', suggestion: null })
  }
  try {
    const saved = localStorage.getItem(STATE_KEY)
    if (saved) {
      fake.restore(JSON.parse(saved))
      return fake
    }
  } catch {
    // a broken copy: start fresh
  }
  // a sample learner who already has a few words, for looking around without signing up
  const fa = currentLanguage() === 'fa'
  const learner = fake.seedUser(SAMPLE_EMAIL, SAMPLE_PASSWORD, fa ? 'سارا' : 'Sara')
  const settings = fake.tables.user_settings!.find((s) => s.user_id === learner.id)!
  settings.onboarded_at = new Date().toISOString()
  for (const word of [TISCH, AUFGEBEN, SCHNELL]) fake.seedWord(learner.id, word as never)
  return fake
}

export function startDemo(): { config: SupabaseConfig; fetch: (input: string, init?: RequestInit) => Promise<Response> } {
  const fake = makeBackend()
  const save = () => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(fake.snapshot()))
    } catch {
      // storage full or blocked: the test simply does not survive a reload
    }
  }
  return {
    config: { url: ORIGIN, anonKey: FAKE_ANON_KEY },
    fetch: async (input, init) => {
      const res = await fake.fetch(input, init)
      save()
      return res
    },
  }
}

/** Forgets everything on this address: account, words, language choice, cached app. */
export async function startOver(): Promise<void> {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {}
  try {
    const dbs = (await indexedDB.databases?.()) ?? []
    await Promise.all(dbs.map((db) => db.name && new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(db.name!)
      req.onsuccess = req.onerror = req.onblocked = () => resolve(null)
    })))
  } catch {}
  location.replace('/')
}

/** The bar's words in every interface language (kept here so they stay out of the real app). */
const BAR_TEXT: Record<string, { note: string; fresh: string; sample: string }> = {
  en: { note: 'Test mode — nothing here is real', fresh: 'Start over', sample: 'Sample learner' },
  fa: { note: 'حالت آزمایشی — هیچ‌چیز واقعی نیست', fresh: 'از اول', sample: 'زبان‌آموز نمونه' },
  de: { note: 'Testmodus – nichts hier ist echt', fresh: 'Neu starten', sample: 'Beispiel-Lerner' },
  fr: { note: 'Mode test — rien ici n’est réel', fresh: 'Recommencer', sample: 'Apprenant d’exemple' },
  it: { note: 'Modalità di prova — qui niente è reale', fresh: 'Ricomincia', sample: 'Studente di esempio' },
  tr: { note: 'Test modu — buradaki hiçbir şey gerçek değil', fresh: 'Baştan başla', sample: 'Örnek öğrenci' },
  uk: { note: 'Тестовий режим — тут усе несправжнє', fresh: 'Почати спочатку', sample: 'Приклад учня' },
  ru: { note: 'Тестовый режим — здесь всё ненастоящее', fresh: 'Начать заново', sample: 'Пример ученика' },
  ar: { note: 'وضع تجريبي — لا شيء هنا حقيقي', fresh: 'ابدأ من جديد', sample: 'متعلّم نموذجي' },
  es: { note: 'Modo de prueba: nada de esto es real', fresh: 'Empezar de nuevo', sample: 'Estudiante de ejemplo' },
  nl: { note: 'Testmodus — niets hier is echt', fresh: 'Opnieuw beginnen', sample: 'Voorbeeldleerling' },
}

/** The bar at the top: says it is a test, and offers "start over" and the sample learner. */
export function demoBar(onSample: () => Promise<void>): HTMLElement {
  const note = h('span')
  const sample = h('button', { type: 'button', onclick: () => void onSample() })
  const fresh = h('button', { type: 'button', onclick: () => void startOver() })
  // the visitor can switch the language at any time; the bar follows
  const write = () => {
    const text = BAR_TEXT[currentLanguage()] ?? BAR_TEXT.en!
    note.textContent = text.note
    sample.textContent = text.sample
    fresh.textContent = text.fresh
  }
  write()
  new MutationObserver(write).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  return h('div', { class: 'demo-bar', role: 'note' }, note, sample, fresh)
}
