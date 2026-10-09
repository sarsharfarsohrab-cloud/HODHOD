/**
 * TEST ONLY — an in-memory stand-in for a Supabase project.
 *
 * It speaks just enough of the Auth, Data and Functions HTTP APIs for this app's
 * automated tests, and it enforces the same rules as the real migrations (ownership,
 * unique words, idempotent reviews). The analyze-word and delete-account functions are
 * the real handlers; only OpenAI is replaced by `aiReply`.
 *
 * Nothing in /src imports this file, and it is not part of the build.
 */
import { handleAnalyzeWord } from '../../supabase/functions/_shared/analyzeWord.ts'
import { handleDeleteAccount } from '../../supabase/functions/_shared/deleteAccount.ts'

type Row = Record<string, unknown>
type User = { id: string; email: string; password: string; meta: Row }

const SERVICE_KEY = 'fake-service-role-key'
export const FAKE_ANON_KEY = 'fake-anon-key'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

export interface FakeOptions {
  /** e-mail confirmation required before the first sign-in */
  confirmEmail?: boolean
  accessTokenSeconds?: number
}

export class FakeSupabase {
  readonly origin = 'https://fake.supabase.test'
  users: User[] = []
  tables: Record<string, Row[]> = {
    profiles: [], user_settings: [], words: [], cards: [], review_events: [], quiz_sessions: [], quiz_answers: [],
    ai_word_cache: [], ai_generation_logs: [],
  }
  /** access token → { userId, expires } */
  tokens = new Map<string, { userId: string; expires: number }>()
  refreshTokens = new Map<string, string>()
  /** Set to make every request fail like a dropped connection. */
  offline = false
  latencyMs = 0
  /** Requests seen, as "METHOD /path". */
  requests: string[] = []
  /** One-shot failures: the next request whose path includes the key gets this status. */
  failNext = new Map<string, number>()
  /** What the stand-in for OpenAI answers; receives the word that was asked for. */
  aiReply: (word: string) => Response | Promise<Response> = () => json({ error: 'no aiReply configured' }, 500)
  aiCalls = 0
  now: () => number = () => Date.now()

  private seq = 0
  private clock = 0

  constructor(private readonly options: FakeOptions = {}) {}

  /** Usable directly as a `fetch` replacement. */
  fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const signal = init.signal
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    if (this.latencyMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.latencyMs)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
    }
    if (this.offline) throw new TypeError('Failed to fetch')
    return this.handle(new Request(input, init))
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    this.requests.push(`${req.method} ${path}`)
    for (const [key, status] of this.failNext) {
      if (path.includes(key)) {
        this.failNext.delete(key)
        return json({ message: 'injected failure' }, status)
      }
    }
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    let res: Response
    try {
      if (path.startsWith('/auth/v1/')) res = await this.auth(req, url)
      else if (path.startsWith('/rest/v1/')) res = await this.rest(req, url)
      else if (path.startsWith('/functions/v1/')) res = await this.functions(req, url)
      else if (path.startsWith('/openai/')) res = await this.openai(req)
      else res = json({ message: 'not found' }, 404)
    } catch (err) {
      if (err instanceof Response) res = err
      else throw err
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }

  // --- helpers -------------------------------------------------------------------

  private id(): string {
    this.seq++
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`
  }

  /** Strictly increasing timestamps with microseconds, like Postgres. */
  private stamp(): string {
    const ms = Math.max(this.now(), this.clock + 1)
    this.clock = ms
    return new Date(ms).toISOString().replace('Z', '000+00:00')
  }

  private issue(user: User): Row {
    const n = ++this.seq
    const access = `access-${n}`
    const refresh = `refresh-${n}`
    const seconds = this.options.accessTokenSeconds ?? 3600
    this.tokens.set(access, { userId: user.id, expires: this.now() + seconds * 1000 })
    this.refreshTokens.set(refresh, user.id)
    return { access_token: access, refresh_token: refresh, expires_in: seconds, token_type: 'bearer', user: { id: user.id, email: user.email } }
  }

  /** Expires every access token (refresh tokens stay valid). */
  expireAccessTokens(): void {
    for (const t of this.tokens.values()) t.expires = 0
  }

  revokeAllSessions(): void {
    this.tokens.clear()
    this.refreshTokens.clear()
  }

  private userOf(req: Request): string | null {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
    if (token === SERVICE_KEY) return 'service'
    const entry = this.tokens.get(token)
    return entry && entry.expires > this.now() ? entry.userId : null
  }

  private requireUser(req: Request): string {
    const id = this.userOf(req)
    if (!id) throw json({ code: 'PGRST301', message: 'JWT expired' }, 401)
    return id
  }

  private createUser(email: string, password: string, meta: Row): User {
    const user: User = { id: this.id(), email, password, meta }
    this.users.push(user)
    const display = typeof meta.display_name === 'string' ? meta.display_name.trim().slice(0, 60) : ''
    this.tables.profiles!.push({ id: user.id, display_name: display || null, native_language: 'fa', active_target_language: 'de', updated_at: this.stamp() })
    this.tables.user_settings!.push({
      user_id: user.id, new_per_day: 10, daily_goal_minutes: 20, max_reviews_per_day: null, desired_retention: 0.9,
      theme: 'system', speech_rate: 1, autoplay_audio: false, reverse_cards: false, updated_at: this.stamp(),
    })
    return user
  }

  /** Test helper: an account that can sign in immediately. */
  seedUser(email: string, password: string, displayName = ''): User {
    return this.createUser(email, password, { display_name: displayName, confirmed: true })
  }

  // --- auth ------------------------------------------------------------------------

  private async auth(req: Request, url: URL): Promise<Response> {
    const path = url.pathname.replace('/auth/v1', '')
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : ((await req.json().catch(() => ({}))) as Row)

    if (path === '/signup' && req.method === 'POST') {
      const email = String(body.email ?? '').toLowerCase()
      const password = String(body.password ?? '')
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ code: 400, error_code: 'validation_failed', msg: 'invalid email' }, 400)
      if (password.length < 6) return json({ code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters' }, 422)
      const existing = this.users.find((u) => u.email === email)
      if (existing) {
        if (this.options.confirmEmail) return json({ id: this.id(), email, identities: [] })
        return json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, 422)
      }
      const user = this.createUser(email, password, { ...(body.data as Row), confirmed: !this.options.confirmEmail })
      if (this.options.confirmEmail) return json({ id: user.id, email, identities: [{ id: user.id }], confirmation_sent_at: new Date().toISOString() })
      return json(this.issue(user))
    }

    if (path === '/token' && req.method === 'POST') {
      const grant = url.searchParams.get('grant_type')
      if (grant === 'password') {
        const user = this.users.find((u) => u.email === String(body.email ?? '').toLowerCase())
        if (!user || user.password !== body.password) return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
        if (user.meta.confirmed === false) return json({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400)
        return json(this.issue(user))
      }
      if (grant === 'refresh_token') {
        const token = String(body.refresh_token ?? '')
        const userId = this.refreshTokens.get(token)
        const user = this.users.find((u) => u.id === userId)
        if (!user) return json({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400)
        this.refreshTokens.delete(token) // single use
        return json(this.issue(user))
      }
    }

    if (path === '/user') {
      const userId = this.userOf(req)
      const user = this.users.find((u) => u.id === userId)
      if (!user) return json({ code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }, 401)
      if (req.method === 'PUT' && typeof body.password === 'string') {
        if (body.password.length < 6) return json({ code: 422, error_code: 'weak_password', msg: 'weak' }, 422)
        user.password = body.password
      }
      return json({ id: user.id, email: user.email })
    }

    if (path === '/logout') return new Response(null, { status: 204 })
    if (path === '/recover') return json({})

    if (path.startsWith('/admin/users/') && req.method === 'DELETE') {
      if (this.userOf(req) !== 'service') return json({ msg: 'forbidden' }, 403)
      const id = path.split('/').pop()!
      this.users = this.users.filter((u) => u.id !== id)
      for (const name of ['profiles', 'user_settings', 'words', 'cards', 'review_events', 'quiz_sessions', 'quiz_answers']) {
        this.tables[name] = this.tables[name]!.filter((r) => r.user_id !== id && r.id !== id)
      }
      for (const log of this.tables.ai_generation_logs!) if (log.user_id === id) log.user_id = null
      for (const [token, entry] of this.tokens) if (entry.userId === id) this.tokens.delete(token)
      for (const [token, userId] of this.refreshTokens) if (userId === id) this.refreshTokens.delete(token)
      return json({})
    }
    return json({ msg: 'not found' }, 404)
  }

  // --- data API ---------------------------------------------------------------------

  private async rest(req: Request, url: URL): Promise<Response> {
    const userId = this.requireUser(req)
    const name = url.pathname.replace('/rest/v1/', '')
    const body = req.method === 'GET' || req.method === 'HEAD' ? null : ((await req.json().catch(() => null)) as Row | null)

    if (name === 'rpc/apply_review') return this.applyReview(userId, body ?? {})
    if (name === 'rpc/undo_review') return this.undoReview(userId, body ?? {})
    if (name === 'rpc/activity_by_day') return this.activityByDay(userId, body ?? {})
    if (name === 'rpc/ensure_reverse_cards') return this.ensureReverseCards(userId)
    if (name === 'rpc/save_quiz') return this.saveQuiz(userId, body ?? {})
    if (name === 'rpc/quiz_word_stats') return this.quizWordStats(userId, body ?? {})

    const table = this.tables[name]
    if (!table) return json({ code: 'PGRST205', message: `table ${name} not found` }, 404)
    const serverOnly = name === 'ai_word_cache' || name === 'ai_generation_logs'
    if (serverOnly && userId !== 'service') return json({ code: '42501', message: 'permission denied' }, 403)
    const ownerColumn = name === 'profiles' ? 'id' : 'user_id'
    const visible = (r: Row) => userId === 'service' || r[ownerColumn] === userId
    const filtered = () => table.filter((r) => visible(r) && this.matches(r, url.searchParams))

    if (req.method === 'GET' || req.method === 'HEAD') {
      let rows = filtered()
      const order = url.searchParams.get('order')
      if (order) {
        const keys = order.split(',').map((k) => k.split('.')[0]!)
        rows = [...rows].sort((a, b) => {
          for (const k of keys) {
            const x = String(a[k] ?? ''), y = String(b[k] ?? '')
            if (x !== y) return x < y ? -1 : 1
          }
          return 0
        })
      }
      const total = rows.length
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      rows = rows.slice(offset, limit ? offset + Number(limit) : undefined)
      if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `*/${total}` } })
      return json(rows)
    }

    if (req.method === 'POST' && body) {
      if (name === 'words') return this.insertWord(userId, body)
      if (serverOnly) {
        if (name === 'ai_word_cache') {
          const same = table.find((r) => r.input_key === body.input_key && r.prompt_version === body.prompt_version && r.target_language === body.target_language)
          if (same) Object.assign(same, body)
          else table.push({ id: this.id(), ...body })
        } else {
          table.push({ id: this.id(), created_at: new Date(this.now()).toISOString(), ...body })
        }
        return new Response(null, { status: 201 })
      }
      return json({ code: '42501', message: 'permission denied' }, 403)
    }

    if (req.method === 'PATCH' && body) {
      if (!['words', 'user_settings', 'profiles'].includes(name)) return json({ code: '42501', message: 'permission denied' }, 403)
      const rows = filtered()
      for (const row of rows) {
        if (name === 'words' && (body.normalized_lemma !== undefined || body.deleted_at === null)) {
          const merged = { ...row, ...body }
          if (this.duplicateWord(merged, String(row.id))) return json({ code: '23505', message: 'duplicate key value violates unique constraint "words_unique_active"' }, 409)
        }
        if (name === 'words' && Array.isArray(body.tags) && body.tags.length > 20) {
          return json({ code: '23514', message: 'violates check constraint' }, 400)
        }
        if (name === 'user_settings' && typeof body.new_per_day === 'number' && (body.new_per_day < 0 || body.new_per_day > 200)) {
          return json({ code: '23514', message: 'violates check constraint' }, 400)
        }
        Object.assign(row, body, { updated_at: this.stamp() })
      }
      return json(rows)
    }
    return json({ message: 'method not allowed' }, 405)
  }

  /** eq filters plus the keyset cursor `or=(updated_at.gt."X",and(updated_at.eq."X",id.gt.Y))`. */
  private matches(row: Row, params: URLSearchParams): boolean {
    for (const [key, value] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue
      if (key === 'or') {
        const m = /^\(updated_at\.gt\."([^"]+)",and\(updated_at\.eq\."[^"]+",id\.gt\.([^)]+)\)\)$/.exec(value)
        if (!m) throw new Error(`fake: unsupported or-filter ${value}`)
        const at = String(row.updated_at)
        if (!(at > m[1]! || (at === m[1]! && String(row.id) > m[2]!))) return false
        continue
      }
      const cell = row[key]
      if (value.startsWith('eq.')) {
        if (String(cell) !== value.slice(3)) return false
      } else if (value.startsWith('gte.')) {
        if (!(String(cell) >= value.slice(4))) return false
      } else if (value.startsWith('in.(')) {
        if (!value.slice(4, -1).split(',').includes(String(cell))) return false
      } else {
        throw new Error(`fake: unsupported filter ${key}=${value}`)
      }
    }
    return true
  }

  private duplicateWord(candidate: Row, exceptId?: string): boolean {
    return this.tables.words!.some(
      (w) => w.id !== exceptId && w.user_id === candidate.user_id && w.deleted_at === null && candidate.deleted_at == null &&
        w.target_language === candidate.target_language && w.normalized_lemma === candidate.normalized_lemma && w.pos === candidate.pos,
    )
  }

  private insertWord(userId: string, body: Row): Response {
    const stamp = this.stamp()
    const row: Row = {
      id: this.id(), user_id: userId, target_language: 'de', native_language: 'fa', is_favorite: false, source: 'ai',
      cefr: null, deleted_at: null, tags: [], ...body, created_at: stamp, updated_at: stamp,
    }
    if (row.user_id !== userId) return json({ code: '42501', message: 'new row violates row-level security policy' }, 403)
    for (const required of ['lemma', 'normalized_lemma', 'pos', 'primary_meaning', 'content']) {
      if (!row[required]) return json({ code: '23502', message: `null value in column "${required}"` }, 400)
    }
    if (this.duplicateWord(row)) return json({ code: '23505', message: 'duplicate key value violates unique constraint "words_unique_active"' }, 409)
    this.tables.words!.push(row)
    this.createCard(userId, String(row.id), 'recognition')
    if (this.tables.user_settings!.some((s) => s.user_id === userId && s.reverse_cards === true)) this.createCard(userId, String(row.id), 'production')
    return json([row], 201)
  }

  private createCard(userId: string, wordId: string, type: string): boolean {
    if (this.tables.cards!.some((c) => c.word_id === wordId && c.card_type === type)) return false
    const stamp = this.stamp()
    this.tables.cards!.push({
      id: this.id(), user_id: userId, word_id: wordId, card_type: type, state: 'new', due: stamp, stability: 0, difficulty: 0,
      scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, last_review: null, introduced_at: null, scheduler_version: null,
      created_at: stamp, updated_at: stamp,
    })
    return true
  }

  private ensureReverseCards(userId: string): Response {
    let created = 0
    for (const word of this.tables.words!) {
      if (word.user_id === userId && word.deleted_at === null && this.createCard(userId, String(word.id), 'production')) created++
    }
    return json(created)
  }

  private undoReview(userId: string, body: Row): Response {
    const event = this.tables.review_events!.find((e) => e.id === body.p_event_id && e.user_id === userId)
    if (!event) return json({ code: 'P0002', message: 'review not found' }, 404)
    const card = this.tables.cards!.find((c) => c.id === event.card_id && c.user_id === userId)
    if (!card) return json({ code: 'P0002', message: 'card not found' }, 404)
    if (event.undone_at) return json(card)
    if (Date.parse(String(card.last_review)) !== Date.parse(String(event.reviewed_at))) {
      return json({ code: 'P0001', message: 'only the latest review of a card can be undone' }, 400)
    }
    event.undone_at = new Date(this.now()).toISOString()
    Object.assign(card, body.p_card as Row, { updated_at: this.stamp() })
    return json(card)
  }

  private saveQuiz(userId: string, body: Row): Response {
    const session = body.p_session as Row
    const answers = body.p_answers as Row[]
    if (!this.tables.quiz_sessions!.some((s) => s.id === session.id)) this.tables.quiz_sessions!.push({ ...session, user_id: userId })
    let stored = 0
    for (const answer of answers) {
      if (this.tables.quiz_answers!.some((a) => a.id === answer.id)) continue
      if (!this.tables.words!.some((w) => w.id === answer.word_id && w.user_id === userId)) continue
      this.tables.quiz_answers!.push({ ...answer, user_id: userId, session_id: session.id })
      stored++
    }
    return json(stored)
  }

  private quizWordStats(userId: string, body: Row): Response {
    const since = Date.parse(String(body.p_since))
    const stats = new Map<string, Row>()
    for (const a of this.tables.quiz_answers!) {
      if (a.user_id !== userId || Date.parse(String(a.answered_at)) < since) continue
      const row = stats.get(String(a.word_id)) ?? { word_id: a.word_id, attempts: 0, wrong: 0, last_answered: null }
      row.attempts = Number(row.attempts) + 1
      if (!a.is_correct) row.wrong = Number(row.wrong) + 1
      if (!row.last_answered || String(a.answered_at) > String(row.last_answered)) row.last_answered = a.answered_at
      stats.set(String(a.word_id), row)
    }
    return json([...stats.values()])
  }

  private applyReview(userId: string, body: Row): Response {
    const event = body.p_event as Row
    const next = body.p_card as Row
    const card = this.tables.cards!.find((c) => c.id === event.card_id && c.user_id === userId)
    if (!card) return json({ code: 'P0002', message: 'card not found' }, 404)
    const known = this.tables.review_events!.some((e) => e.id === event.id)
    if (!known) {
      this.tables.review_events!.push({ ...event, user_id: userId, word_id: card.word_id })
      const at = String(event.reviewed_at)
      if (card.last_review === null || Date.parse(String(card.last_review)) <= Date.parse(at)) {
        Object.assign(card, next, {
          last_review: at, introduced_at: card.introduced_at ?? at, scheduler_version: event.scheduler_version, updated_at: this.stamp(),
        })
      }
    }
    return json(card)
  }

  private activityByDay(userId: string, body: Row): Response {
    const zone = String(body.p_time_zone ?? 'UTC')
    const format = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const days = new Map<string, Row>()
    for (const e of this.tables.review_events!) {
      if (e.user_id !== userId || e.undone_at) continue
      const key = format.format(new Date(Date.parse(String(e.reviewed_at)) - 4 * 3_600_000))
      if (key < String(body.p_since)) continue
      const day = days.get(key) ?? { day: key, reviews: 0, again: 0, new_cards: 0, duration_ms: 0, mature_reviews: 0, mature_again: 0 }
      if (e.state_before === 'review') {
        day.mature_reviews = Number(day.mature_reviews) + 1
        if (e.rating === 1) day.mature_again = Number(day.mature_again) + 1
      }
      day.reviews = Number(day.reviews) + 1
      if (e.rating === 1) day.again = Number(day.again) + 1
      if (e.state_before === 'new') day.new_cards = Number(day.new_cards) + 1
      day.duration_ms = Number(day.duration_ms) + (Number(e.duration_ms) || 0)
      days.set(key, day)
    }
    return json([...days.values()].sort((a, b) => (String(a.day) < String(b.day) ? -1 : 1)))
  }

  // --- functions ----------------------------------------------------------------------

  private async functions(req: Request, url: URL): Promise<Response> {
    const name = url.pathname.replace('/functions/v1/', '')
    const env = { supabaseUrl: this.origin, serviceRoleKey: SERVICE_KEY }
    const internal = (input: string, init?: RequestInit) => this.handle(new Request(input, init))
    if (name === 'analyze-word') {
      return handleAnalyzeWord(
        req,
        { ...env, aiApiKey: 'fake-ai-key', aiModel: 'fake-model', aiBaseUrl: `${this.origin}/openai`, aiApiStyle: 'responses', timeoutMs: 2_000 },
        internal,
        async () => {},
      )
    }
    if (name === 'delete-account') return handleDeleteAccount(req, env, internal)
    return json({ code: 'NOT_FOUND', message: 'Requested function was not found' }, 404)
  }

  private async openai(req: Request): Promise<Response> {
    this.aiCalls++
    const body = (await req.json()) as { input: { role: string; content: string }[] }
    const user = body.input.find((m) => m.role === 'user')?.content ?? ''
    const word = JSON.parse(user.replace(/^German word: /, '')) as string
    return this.aiReply(word)
  }
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-client-info',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS',
}

/** Wraps a model answer the way the OpenAI Responses API does. */
export function aiResponse(output: unknown): Response {
  return json({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
    usage: { input_tokens: 900, output_tokens: 1400 },
  })
}
