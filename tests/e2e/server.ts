/**
 * TEST ONLY — serves the built app together with the in-memory test backend on one port,
 * so the browser tests exercise the real app code against a controllable server.
 *   bun run tests/e2e/server.ts   (after `bun run scripts/build.ts --dev`)
 */
import { join, normalize } from 'node:path'
import { aiResponse, FAKE_ANON_KEY, FakeSupabase } from '../fake-backend/fakeSupabase.ts'
import { asAiOutput, AUFGEBEN, SCHNELL, TISCH } from '../fixtures/words.ts'

const dist = join(import.meta.dir, '..', '..', 'dist')
const port = Number(process.env.PORT ?? 4174)

let backend = new FakeSupabase()
let aiMode: 'ok' | 'error' | 'invalid' | 'slow' = 'ok'

const empty = { lemma: '', meanings: [], noun: null, verb: null, adjective: null, pos: 'other', cefr: 'A1' }

function configure() {
  backend.aiReply = async (word) => {
    if (aiMode === 'slow') await new Promise((r) => setTimeout(r, 1500))
    if (aiMode === 'error') return new Response('upstream down', { status: 503 })
    if (aiMode === 'invalid') return aiResponse({ status: 'ok', lemma: word })
    const key = word.toLowerCase()
    if (key === 'aufgeben' || key === 'gab') return aiResponse(asAiOutput(AUFGEBEN, key === 'gab' ? { input_note: '«gab» گذشتهٔ سادهٔ فعل «geben» است؛ این کارت برای «aufgeben» ساخته شد.' } : {}))
    if (key === 'tisch' || key === 'der tisch') return aiResponse(asAiOutput(TISCH))
    if (key === 'schnell') return aiResponse(asAiOutput(SCHNELL))
    if (key === 'strase') return aiResponse({ ...asAiOutput(TISCH), ...empty, status: 'misspelled', suggestion: 'Straße' })
    if (key === 'straße') {
      return aiResponse(asAiOutput({ ...TISCH, lemma: 'Straße', ipa: 'ˈʃtʁaːsə', noun: { article: 'die', plural: 'Straßen', genitive: 'Straße', pluralOnly: false },
        meanings: [{ ...TISCH.meanings[0]!, translation: 'خیابان' }], collocations: [] }))
    }
    if (/^wort[a-z]$/.test(key)) {
      return aiResponse(asAiOutput({ ...TISCH, lemma: `Wort${key.slice(4)}`, noun: { article: 'das', plural: 'Wörter', genitive: 'Wortes', pluralOnly: false },
        meanings: [{ ...TISCH.meanings[0]!, translation: 'واژهٔ آزمایشی' }], collocations: [] }))
    }
    return aiResponse({ ...asAiOutput(TISCH), ...empty, status: 'not_a_word' })
  }
}
configure()

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path.startsWith('/__test/')) {
      const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
      switch (path) {
        case '/__test/reset':
          backend = new FakeSupabase({ confirmEmail: body.confirmEmail === true })
          aiMode = 'ok'
          configure()
          break
        case '/__test/ai':
          aiMode = body.mode as typeof aiMode
          break
        case '/__test/clear-ai-logs':
          backend.tables.ai_generation_logs = []
          break
        case '/__test/offline':
          backend.offline = body.offline === true
          break
        case '/__test/latency':
          backend.latencyMs = Number(body.ms) || 0
          break
        case '/__test/shift-due': {
          // moves every card's due date into the past, as if days had gone by
          const ms = Number(body.days) * 86_400_000
          for (const card of backend.tables.cards!) {
            card.due = new Date(Date.parse(String(card.due)) - ms).toISOString()
            if (card.last_review) card.last_review = new Date(Date.parse(String(card.last_review)) - ms).toISOString()
            if (card.introduced_at) card.introduced_at = new Date(Date.parse(String(card.introduced_at)) - ms).toISOString()
            card.updated_at = new Date().toISOString().replace('Z', '000+00:00')
          }
          for (const event of backend.tables.review_events!) event.reviewed_at = new Date(Date.parse(String(event.reviewed_at)) - ms).toISOString()
          break
        }
        case '/__test/state':
          return Response.json({
            users: backend.users.length,
            words: backend.tables.words,
            cards: backend.tables.cards,
            reviews: backend.tables.review_events,
            settings: backend.tables.user_settings,
            aiCalls: backend.aiCalls,
            logs: backend.tables.ai_generation_logs,
          })
      }
      return Response.json({ ok: true })
    }

    if (/^\/(auth|rest|functions|openai)\//.test(path)) {
      if (backend.offline) return new Response(null, { status: 503 }) // the browser is taken offline separately
      if (backend.latencyMs) await new Promise((r) => setTimeout(r, backend.latencyMs))
      return backend.handle(new Request(`${backend.origin}${path}${url.search}`, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer() }))
    }

    if (path === '/config.js') {
      return new Response(`window.HODHOD_CONFIG = { supabaseUrl: 'http://localhost:${port}', supabaseAnonKey: '${FAKE_ANON_KEY}' }`, { headers: { 'content-type': 'text/javascript' } })
    }

    const clean = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '')
    const file = Bun.file(join(dist, clean === '/' ? 'index.html' : clean))
    return (await file.exists()) ? new Response(file) : new Response('not found', { status: 404 })
  },
})
console.log(`test server on http://localhost:${port}`)
