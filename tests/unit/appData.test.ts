/** Sign-in, saving, studying and synchronisation, end to end against the in-memory test backend. */
import { beforeEach, describe, expect, test } from 'bun:test'
import { createFsrsScheduler } from '../../src/core/fsrsScheduler.ts'
import { toSchedulingState } from '../../src/core/cards.ts'
import { nextCard, queueCounts } from '../../src/core/queue.ts'
import { dayKey } from '../../src/core/time.ts'
import type { Rating } from '../../src/core/types.ts'
import { AppData } from '../../src/data/appData.ts'
import { AppError } from '../../src/data/errors.ts'
import { MemoryLocalDb, type LocalDb } from '../../src/data/localDb.ts'
import { SupabaseClient, type KeyValueStore } from '../../src/data/supabase.ts'
import { aiResponse, FAKE_ANON_KEY, FakeSupabase } from '../fake-backend/fakeSupabase.ts'
import { asAiOutput, AUFGEBEN, SCHNELL, TISCH } from '../fixtures/words.ts'

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
  removeItem = (k: string) => void this.data.delete(k)
}

const scheduler = createFsrsScheduler({ desiredRetention: 0.9, fuzz: false })
const REDIRECT = 'https://app.test/'

let backend: FakeSupabase
let clock: number
const now = () => new Date(clock)

interface Device {
  client: SupabaseClient
  store: MemoryStore
  db: LocalDb
  online: boolean
  data: AppData
  open(): Promise<AppData>
}

/** One browser profile: its own storage and its own connection state. */
function device(): Device {
  const store = new MemoryStore()
  const d = {
    store,
    db: new MemoryLocalDb() as LocalDb,
    online: true,
    client: undefined as unknown as SupabaseClient,
    data: undefined as unknown as AppData,
    async open() {
      d.data = new AppData({ client: d.client, db: d.db, userId: d.client.session!.userId, now, isOnline: () => d.online })
      await d.data.load()
      await d.data.syncNow()
      return d.data
    },
  }
  d.client = new SupabaseClient(
    { url: backend.origin, anonKey: FAKE_ANON_KEY },
    store,
    (input, init) => (d.online ? backend.fetch(input, init) : Promise.reject(new TypeError('Failed to fetch'))),
    () => clock,
  )
  return d
}

async function signedIn(email = 'sohrab@example.test'): Promise<Device> {
  if (!backend.users.some((u) => u.email === email)) backend.seedUser(email, 'correct horse', 'سهراب')
  const d = device()
  await d.client.signIn(email, 'correct horse')
  await d.open()
  return d
}

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p
    return 'no error'
  } catch (e) {
    return e instanceof AppError ? `${e.kind}:${e.code}` : `other:${String(e)}`
  }
}

async function answer(d: Device, rating: Rating) {
  const next = nextCard(d.data.activeCards(), { settings: d.data.settings, now: now() })
  if (next.kind !== 'card') throw new Error(`no card to answer (${next.kind})`)
  const result = scheduler.preview(toSchedulingState(next.card), now())[rating]
  return d.data.recordReview(next.card, result, scheduler.version, 4000, 'session-1')
}
const settle = () => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
  backend = new FakeSupabase()
  clock = new Date(2026, 9, 9, 11, 0, 0).getTime()
  backend.now = () => clock
  backend.aiReply = (word) => aiResponse(asAiOutput(word.toLowerCase().includes('tisch') ? TISCH : word === 'schnell' ? SCHNELL : AUFGEBEN))
})

describe('accounts', () => {
  test('sign up creates the account, its profile and default settings', async () => {
    const d = device()
    expect(await d.client.signUp('new@example.test', 'correct horse', 'نگار', REDIRECT)).toEqual({ needsEmailConfirmation: false })
    const data = await d.open()
    expect(data.profile).toEqual({ displayName: 'نگار', nativeLanguage: 'fa', activeTargetLanguage: 'de' })
    expect(data.settings.newPerDay).toBe(10)
    expect(data.settings.dailyGoalMinutes).toBe(20)
  })
  test('sign up with e-mail confirmation does not sign in yet', async () => {
    backend = new FakeSupabase({ confirmEmail: true })
    const d = device()
    expect(await d.client.signUp('new@example.test', 'correct horse', '', REDIRECT)).toEqual({ needsEmailConfirmation: true })
    expect(d.client.session).toBe(null)
    expect(await kindOf(d.client.signIn('new@example.test', 'correct horse'))).toBe('auth:email_not_confirmed')
    expect(await kindOf(d.client.signUp('new@example.test', 'correct horse', '', REDIRECT))).toBe('auth:user_already_exists')
  })
  test('wrong password, unknown user, weak password and duplicate e-mail are told apart', async () => {
    backend.seedUser('a@example.test', 'correct horse')
    const d = device()
    expect(await kindOf(d.client.signIn('a@example.test', 'wrong'))).toBe('auth:invalid_credentials')
    expect(await kindOf(d.client.signIn('nobody@example.test', 'x'))).toBe('auth:invalid_credentials')
    expect(await kindOf(d.client.signUp('b@example.test', '123', '', REDIRECT))).toBe('auth:weak_password')
    expect(await kindOf(d.client.signUp('a@example.test', 'correct horse', '', REDIRECT))).toBe('auth:user_already_exists')
    expect(d.client.session).toBe(null)
  })
  test('no connection is reported as offline, not as a wrong password', async () => {
    backend.seedUser('a@example.test', 'correct horse')
    const d = device()
    d.online = false
    expect(await kindOf(d.client.signIn('a@example.test', 'correct horse'))).toBe('offline:network')
  })
  test('the session survives a restart of the app', async () => {
    const d = await signedIn()
    const reopened = new SupabaseClient({ url: backend.origin, anonKey: FAKE_ANON_KEY }, d.store, backend.fetch, () => clock)
    expect(reopened.session?.userId).toBe(d.client.session!.userId)
  })
  test('an expired access token is refreshed without the user noticing', async () => {
    const d = await signedIn()
    const before = d.client.session!.accessToken
    clock += 2 * 3_600_000
    backend.expireAccessTokens()
    await d.data.syncNow()
    expect(d.data.sync.problem).toBe(null)
    expect(d.client.session!.accessToken).not.toBe(before)
  })
  test('a token the server rejects early is refreshed once and the request retried', async () => {
    const d = await signedIn()
    backend.expireAccessTokens() // the client still believes its token is good
    await d.data.syncNow()
    expect(d.data.sync.problem).toBe(null)
  })
  test('parallel requests share one refresh (refresh tokens are single-use)', async () => {
    const d = await signedIn()
    clock += 2 * 3_600_000
    backend.requests = []
    await Promise.all([d.client.select('words', { select: '*' }), d.client.select('cards', { select: '*' }), d.client.select('profiles', { select: '*' })])
    expect(backend.requests.filter((r) => r.includes('/auth/v1/token')).length).toBe(1)
  })
  test('a revoked session signs the user out instead of looping', async () => {
    const d = await signedIn()
    const seen: unknown[] = []
    d.client.onSessionChange((s) => seen.push(s))
    backend.revokeAllSessions()
    clock += 2 * 3_600_000
    expect(await kindOf(d.client.select('words', { select: '*' }))).toBe('auth:session_expired')
    expect(d.client.session).toBe(null)
    expect(seen).toEqual([null])
  })
  test('being offline never signs the user out', async () => {
    const d = await signedIn()
    clock += 2 * 3_600_000
    d.online = false
    expect(await kindOf(d.client.select('words', { select: '*' }))).toBe('offline:network')
    expect(d.client.session).not.toBe(null)
  })
  test('e-mail links (confirmation, password reset) sign in from the address bar', async () => {
    const user = backend.seedUser('a@example.test', 'correct horse')
    const d = device()
    const helper = device()
    await helper.client.signIn('a@example.test', 'correct horse')
    const s = helper.client.session!
    expect(await d.client.consumeUrlFragment(`#access_token=${s.accessToken}&refresh_token=${s.refreshToken}&expires_in=3600&type=recovery`)).toEqual({ type: 'recovery' })
    expect(d.client.session!.userId).toBe(user.id)
    await d.client.updatePassword('a new long password')
    expect(await kindOf(device().client.signIn('a@example.test', 'correct horse'))).toBe('auth:invalid_credentials')
    expect(await d.client.consumeUrlFragment('#/home')).toBe(null)
    expect(await kindOf(d.client.consumeUrlFragment('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'))).toBe('auth:otp_expired')
  })
  test('sign out clears the session and this device’s copy of the data', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    await d.data.signOut()
    expect(d.client.session).toBe(null)
    expect(await d.db.getAll('words')).toEqual([])
    expect(d.store.data.size).toBe(0)
  })
  test('log out, log in again: the data is back', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    await d.data.setFavorite([...d.data.words.keys()][0]!, true)
    await d.data.signOut()
    const again = await signedIn()
    expect([...again.data.words.values()].map((w) => [w.lemma, w.isFavorite])).toEqual([['Tisch', true]])
  })
})

describe('creating words', () => {
  test('the AI draft is not saved until the user confirms it', async () => {
    const d = await signedIn()
    const draft = await d.data.analyzeWord('aufgeben')
    expect(draft.status).toBe('ok')
    expect(backend.tables.words!.length).toBe(0)
    expect(d.data.words.size).toBe(0)
  })
  test('confirming saves the word with a "new" card that is not being learned yet', async () => {
    const d = await signedIn()
    const draft = await d.data.analyzeWord('aufgeben')
    if (draft.status !== 'ok') throw new Error('expected a draft')
    const word = await d.data.saveWord(draft.content, { source: 'ai', promptVersion: draft.promptVersion, model: draft.model })
    expect(word.lemma).toBe('aufgeben')
    expect(word.primaryMeaning).toBe('تسلیم شدن، دست کشیدن')
    const card = d.data.cards.get(word.id)!
    expect(card.state).toBe('new')
    expect(card.introducedAt).toBe(null)
    expect(backend.tables.words![0]).toMatchObject({ ai_prompt_version: 'word_analysis_v2', ai_model: 'fake-model', normalized_lemma: 'aufgeben', pos: 'verb' })
  })
  test('an edited draft is saved as edited', async () => {
    const d = await signedIn()
    const edited = structuredClone(TISCH)
    edited.meanings[0]!.translation = 'میز، میز کار'
    edited.cefr = 'A2'
    const word = await d.data.saveWord(edited, { source: 'ai' })
    expect(word.primaryMeaning).toBe('میز، میز کار')
    expect(word.cefr).toBe('A2')
  })
  test('duplicates are found before and after the AI call, and refused by the database too', async () => {
    const d = await signedIn()
    const word = await d.data.saveWord(TISCH, { source: 'ai' })
    expect(d.data.findDuplicate('tisch')?.id).toBe(word.id) // typed in lower case, before the AI answers
    expect(d.data.findDuplicate('der Tisch')?.id).toBe(word.id)
    expect(d.data.findDuplicate('Tisch', 'noun')?.id).toBe(word.id)
    expect(d.data.findDuplicate('Tisch', 'verb')).toBe(undefined)
    expect(await kindOf(d.data.saveWord(TISCH, { source: 'ai' }))).toBe('duplicate:duplicate_word')
    // a second device that has not synced yet cannot sneak a duplicate in either
    const other = await signedIn()
    other.data.words.clear()
    expect(await kindOf(other.data.saveWord(TISCH, { source: 'ai' }))).toBe('duplicate:23505')
    expect(backend.tables.words!.length).toBe(1)
  })
  test('the same spelling with another part of speech is a different word', async () => {
    const d = await signedIn()
    await d.data.saveWord({ ...TISCH, lemma: 'Essen' }, { source: 'ai' })
    await d.data.saveWord({ ...AUFGEBEN, lemma: 'essen' }, { source: 'ai' })
    expect(d.data.words.size).toBe(2)
  })
  test('creating a word needs a connection and says so', async () => {
    const d = await signedIn()
    d.online = false
    expect(await kindOf(d.data.analyzeWord('Tisch'))).toBe('offline:offline')
    expect(await kindOf(d.data.saveWord(TISCH, { source: 'ai' }))).toBe('offline:offline')
  })
  test('AI problems reach the app as distinct, user-explainable errors', async () => {
    const d = await signedIn()
    expect(await kindOf(d.data.analyzeWord('das sind viel zu viele Wörter hier'))).toBe('validation:multiple_words')
    backend.aiReply = () => new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 })
    expect(await kindOf(d.data.analyzeWord('Tisch'))).toBe('not_configured:ai_quota_exhausted')
    backend.aiReply = () => aiResponse({ status: 'ok', lemma: 'x' })
    expect(await kindOf(d.data.analyzeWord('Lampe'))).toBe('server:ai_invalid_output')
    backend.failNext.set('/functions/v1/analyze-word', 404)
    expect(await kindOf(d.data.analyzeWord('Lampe'))).toBe('not_configured:function_missing')
  })
  test('a request the user walked away from can be cancelled', async () => {
    const d = await signedIn()
    backend.latencyMs = 200
    const controller = new AbortController()
    const pending = kindOf(d.data.analyzeWord('Tisch', { signal: controller.signal }))
    controller.abort()
    expect(await pending).toBe('timeout:cancelled')
  })
})

describe('editing, favourites, archive', () => {
  test('editing updates content and the derived columns together', async () => {
    const d = await signedIn()
    const word = await d.data.saveWord(TISCH, { source: 'ai' })
    const edited = structuredClone(TISCH)
    edited.meanings[0]!.translation = 'میز تحریر'
    edited.cefr = 'A2'
    const saved = await d.data.updateWordContent(word.id, edited)
    expect(saved.primaryMeaning).toBe('میز تحریر')
    expect(backend.tables.words![0]).toMatchObject({ primary_meaning: 'میز تحریر', cefr: 'A2' })
    expect(backend.tables.cards!.length).toBe(1) // the card and its progress are untouched
  })
  test('an edit never silently overwrites a newer change from another device', async () => {
    const phone = await signedIn()
    const word = await phone.data.saveWord(TISCH, { source: 'ai' })
    const laptop = await signedIn()
    const fromLaptop = structuredClone(TISCH)
    fromLaptop.notes = 'یادداشت لپ‌تاپ'
    await laptop.data.updateWordContent(word.id, fromLaptop)

    const fromPhone = structuredClone(TISCH)
    fromPhone.notes = 'یادداشت گوشی'
    expect(await kindOf(phone.data.updateWordContent(word.id, fromPhone))).toBe('conflict:word_changed_elsewhere')
    expect(backend.tables.words![0]!.content).toMatchObject({ notes: 'یادداشت لپ‌تاپ' })
    expect(phone.data.words.get(word.id)!.content.notes).toBe('یادداشت لپ‌تاپ') // the newer version was loaded
  })
  test('renaming a word onto an existing one is refused', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    const lampe = await d.data.saveWord({ ...TISCH, lemma: 'Lampe' }, { source: 'ai' })
    expect(await kindOf(d.data.updateWordContent(lampe.id, { ...TISCH }))).toBe('duplicate:duplicate_word')
  })
  test('favourites work offline and reach the server later', async () => {
    const d = await signedIn()
    const word = await d.data.saveWord(TISCH, { source: 'ai' })
    d.online = false
    await d.data.setFavorite(word.id, true)
    expect(d.data.words.get(word.id)!.isFavorite).toBe(true)
    expect(d.data.sync.pending).toBe(1)
    expect(backend.tables.words![0]!.is_favorite).toBe(false)
    d.online = true
    await d.data.syncNow()
    expect(d.data.sync.pending).toBe(0)
    expect(backend.tables.words![0]!.is_favorite).toBe(true)
  })
  test('archiving removes the word from the bank and the queue but keeps its history', async () => {
    const d = await signedIn()
    const word = await d.data.saveWord(TISCH, { source: 'ai' })
    await answer(d, 3)
    await d.data.archiveWords([word.id])
    await d.data.syncNow()
    expect(d.data.words.size).toBe(0)
    expect(d.data.activeCards()).toEqual([])
    expect(backend.tables.words![0]!.deleted_at).not.toBe(null)
    expect(backend.tables.review_events!.length).toBe(1)
    // the word can be added again later as a fresh entry
    await d.data.saveWord(TISCH, { source: 'ai' })
    expect(d.data.words.size).toBe(1)
  })
})

describe('studying and sync', () => {
  test('a review moves the card, is stored with full scheduler detail and counts for today', async () => {
    const d = await signedIn()
    const word = await d.data.saveWord(TISCH, { source: 'ai' })
    const card = await answer(d, 3)
    await settle()
    expect(card.state).toBe('learning')
    expect(card.introducedAt).toBe(now().toISOString())
    expect(d.data.today()).toEqual({ reviews: 1, again: 0, newCards: 1, durationMs: 4000 })
    expect(d.data.sync.pending).toBe(0)
    expect(backend.tables.review_events![0]).toMatchObject({
      word_id: word.id, rating: 3, state_before: 'new', state_after: 'learning', scheduler_version: 'fsrs-6/ts-fsrs-5.4.2',
      duration_ms: 4000, session_id: 'session-1',
    })
    expect(backend.tables.cards![0]).toMatchObject({ state: 'learning', reps: 1 })
  })
  test('full path of a new card: learning steps today, review days later', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    let card = await answer(d, 3) // good → second learning step in 10 min
    expect(nextCard(d.data.activeCards(), { settings: d.data.settings, now: now(), lastCardId: null }).kind).toBe('card') // brought forward
    clock += 10 * 60_000
    card = await answer(d, 3) // graduates
    expect(card.state).toBe('review')
    expect(card.scheduledDays).toBeGreaterThanOrEqual(1)
    expect(nextCard(d.data.activeCards(), { settings: d.data.settings, now: now() }).kind).toBe('done')
    clock = new Date(card.due).getTime() + 60_000
    expect(queueCounts(d.data.activeCards(), { settings: d.data.settings, now: now() }).reviews).toBe(1)
  })
  test('reviews made offline are kept and uploaded once the connection is back', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    await d.data.saveWord(AUFGEBEN, { source: 'ai' })
    d.online = false
    await answer(d, 3)
    await answer(d, 1)
    expect(d.data.sync.pending).toBe(2)
    expect(d.data.today()!.reviews).toBe(2)
    expect(backend.tables.review_events!.length).toBe(0)

    // the app is closed and reopened while still offline: nothing is lost
    const reopened = new AppData({ client: d.client, db: d.db, userId: d.data.userId, now, isOnline: () => d.online })
    await reopened.load()
    expect(reopened.sync.pending).toBe(2)
    expect(reopened.today()!.reviews).toBe(2)
    expect([...reopened.cards.values()].map((c) => c.state).sort()).toEqual(['learning', 'learning'])

    d.online = true
    await reopened.syncNow()
    expect(reopened.sync.pending).toBe(0)
    expect(backend.tables.review_events!.length).toBe(2)
    expect(reopened.today()!.reviews).toBe(2) // not double-counted after the server totals arrive
  })
  test('an upload whose answer got lost is retried without creating a second review', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    const realFetch = backend.fetch
    let dropped = false
    backend.fetch = async (input, init) => {
      const res = await realFetch(input, init)
      if (!dropped && input.includes('apply_review')) {
        dropped = true
        throw new TypeError('connection lost after the server processed the request')
      }
      return res
    }
    const flaky = device()
    flaky.client = new SupabaseClient({ url: backend.origin, anonKey: FAKE_ANON_KEY }, d.store, (i, n) => backend.fetch(i, n), () => clock)
    flaky.db = d.db
    await flaky.open()
    await answer(flaky, 3)
    await settle()
    expect(flaky.data.sync.pending).toBe(1)
    expect(backend.tables.review_events!.length).toBe(1) // the server did get it
    await flaky.data.syncNow()
    expect(flaky.data.sync.pending).toBe(0)
    expect(backend.tables.review_events!.length).toBe(1)
    expect(backend.tables.cards![0]!.reps).toBe(1)
  })
  test('a server error keeps the review queued; a permanent refusal drops it and takes the server state', async () => {
    const d = await signedIn()
    const word = await d.data.saveWord(TISCH, { source: 'ai' })
    backend.failNext.set('apply_review', 503)
    await answer(d, 3)
    await settle()
    expect(d.data.sync.pending).toBe(1)
    await d.data.syncNow()
    expect(d.data.sync.pending).toBe(0)

    backend.tables.cards = [] // the card vanished on the server (e.g. account data reset elsewhere)
    clock += 11 * 60_000
    const local = d.data.cards.get(word.id)!
    await d.data.recordReview(local, scheduler.preview(toSchedulingState(local), now())[3], scheduler.version, 1000, null)
    await settle()
    expect(d.data.sync.pending).toBe(0) // not stuck forever
  })
  test('two devices: words, progress and settings arrive on the other one', async () => {
    const phone = await signedIn()
    const laptop = await signedIn()
    await phone.data.saveWord(TISCH, { source: 'ai' })
    await answer(phone, 3)
    await phone.data.updateSettings({ newPerDay: 15, dailyGoalMinutes: 30 })
    await settle()
    expect(laptop.data.words.size).toBe(0)
    await laptop.data.syncNow()
    expect(laptop.data.words.size).toBe(1)
    expect(laptop.data.activeCards()[0]!.state).toBe('learning')
    expect(laptop.data.settings.newPerDay).toBe(15)
    expect(laptop.data.today()!.reviews).toBe(1)
  })
  test('sync only downloads what changed', async () => {
    const d = await signedIn()
    for (const lemma of ['Tisch', 'Lampe', 'Stuhl']) await d.data.saveWord({ ...TISCH, lemma }, { source: 'ai' })
    const other = await signedIn()
    expect(other.data.words.size).toBe(3)
    await d.data.saveWord({ ...TISCH, lemma: 'Fenster' }, { source: 'ai' })
    let wordsDownloaded = 0
    const realHandle = backend.handle.bind(backend)
    backend.handle = async (req) => {
      const res = await realHandle(req)
      if (req.method === 'GET' && new URL(req.url).pathname === '/rest/v1/words') wordsDownloaded += ((await res.clone().json()) as unknown[]).length
      return res
    }
    await other.data.syncNow()
    expect(wordsDownloaded).toBe(1)
    expect(other.data.words.size).toBe(4)
  })
  test('large word banks are downloaded in pages without missing or repeating rows', async () => {
    const d = await signedIn()
    const user = d.data.userId
    for (let i = 0; i < 1203; i++) {
      // many rows with the very same timestamp, as a bulk update would produce
      backend.tables.words!.push({
        id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, user_id: user, target_language: 'de', native_language: 'fa',
        lemma: `Wort${i}`, normalized_lemma: `Wort${i}`, pos: 'noun', cefr: 'A1', primary_meaning: 'واژه', content: TISCH, is_favorite: false,
        source: 'ai', created_at: '2026-10-01T00:00:00.000000+00:00', updated_at: '2026-10-01T00:00:00.000000+00:00', deleted_at: null,
      })
    }
    const fresh = await signedIn()
    expect(fresh.data.words.size).toBe(1203)
    expect(backend.requests.filter((r) => r === 'GET /rest/v1/words').length).toBeGreaterThanOrEqual(3)
  })
  test('quick setting changes offline are merged and invalid values never stick on the server', async () => {
    const d = await signedIn()
    d.online = false
    await d.data.updateSettings({ newPerDay: 12 })
    await d.data.updateSettings({ newPerDay: 14 })
    await d.data.updateSettings({ theme: 'dark' })
    expect(d.data.sync.pending).toBe(1)
    d.online = true
    await d.data.syncNow()
    expect(backend.tables.user_settings![0]).toMatchObject({ new_per_day: 14, theme: 'dark' })
  })
  test('streak data: reviews are attributed to the study day they happened on', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    clock = new Date(2026, 9, 10, 1, 30).getTime() // after midnight, before 04:00
    await answer(d, 3)
    await d.data.syncNow()
    expect([...d.data.activity.keys()]).toEqual(['2026-10-09'])
    expect(dayKey(now())).toBe('2026-10-09')
  })
})

describe('privacy', () => {
  test('one account never sees another account’s words, cards or history', async () => {
    const a = await signedIn('a@example.test')
    await a.data.saveWord(TISCH, { source: 'ai' })
    await answer(a, 3)
    await settle()
    const b = await signedIn('b@example.test')
    expect(b.data.words.size).toBe(0)
    expect(b.data.cards.size).toBe(0)
    expect(b.data.activity.size).toBe(0)
    expect(await b.client.select('review_events', { select: '*' })).toEqual([])
    expect(await kindOf(b.client.select('ai_word_cache', { select: '*' }))).toBe('auth:forbidden')
    // …but B benefits from the shared AI cache without another paid generation
    const calls = backend.aiCalls
    await a.data.analyzeWord('Lampe')
    const hit = await b.data.analyzeWord('Lampe')
    expect(hit.cached).toBe(true)
    expect(backend.aiCalls).toBe(calls + 1)
  })
  test('export contains the account’s words, cards and complete review history', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    await answer(d, 3)
    const dump = (await d.data.exportData()) as { words: unknown[]; cards: unknown[]; reviewEvents: unknown[]; format: string }
    expect(dump.format).toBe('hodhod-export')
    expect([dump.words.length, dump.cards.length, dump.reviewEvents.length]).toEqual([1, 1, 1])
    expect(JSON.stringify(dump)).not.toContain('access-')
  })
  test('deleting the account removes everything on the server and on the device', async () => {
    const d = await signedIn()
    await d.data.saveWord(TISCH, { source: 'ai' })
    await answer(d, 3)
    await settle()
    await d.data.deleteAccount()
    expect(backend.users.length).toBe(0)
    for (const table of ['profiles', 'user_settings', 'words', 'cards', 'review_events']) expect(backend.tables[table]).toEqual([])
    expect(d.client.session).toBe(null)
    expect(await d.db.getAll('words')).toEqual([])
    expect(await kindOf(device().client.signIn('sohrab@example.test', 'correct horse'))).toBe('auth:invalid_credentials')
  })
})
