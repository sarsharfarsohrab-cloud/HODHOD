/** The stage-3 server functions: speech, stories, push reminders and admin actions. */
import { beforeEach, describe, expect, test } from 'bun:test'
import { handleAdminActions } from '../../supabase/functions/_shared/adminActions.ts'
import { handlePush, reminderMessage } from '../../supabase/functions/_shared/push.ts'
import { handleStory, validateStory } from '../../supabase/functions/_shared/story.ts'
import { handleTts, normalizeSpeechText } from '../../supabase/functions/_shared/tts.ts'
import { b64urlEncode } from '../../supabase/functions/_shared/webpush.ts'

const USER = '00000000-0000-0000-0000-00000000000a'
const OTHER = '00000000-0000-0000-0000-00000000000b'
const BASE = { supabaseUrl: 'https://project.test', serviceRoleKey: 'service-key', allowedOrigins: '' }

interface World {
  tables: Record<string, Record<string, unknown>[]>
  admins: Set<string>
  budget: Record<string, unknown>
  requests: { method: string; url: string; body?: unknown; headers: Headers }[]
  ai: unknown[]
  tts: Response[]
  push: number[]
  candidates: Record<string, unknown>[]
  fetch: (input: string, init?: RequestInit) => Promise<Response>
}

function world(): World {
  const w: World = {
    tables: { tts_cache: [], ai_generation_logs: [], stories: [], push_secrets: [], push_subscriptions: [], notification_log: [], announcements: [], user_settings: [], user_limits: [] },
    admins: new Set(),
    budget: { spent_today_usd: 0, daily_usd: 1.5, user_today: 0, user_limit: null, blocked: false, account_age_hours: 500, new_user_days: 3, new_user_per_day: 30, kind_per_day: 3 },
    requests: [],
    ai: [],
    tts: [],
    push: [],
    candidates: [],
    async fetch(input, init = {}) {
      const url = new URL(input)
      const headers = new Headers(init.headers)
      const method = init.method ?? 'GET'
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : init.body
      w.requests.push({ method, url: input, body, headers })
      if (url.host === 'push.test') return new Response(null, { status: w.push.shift() ?? 201 })
      if (url.host === 'ai.test') {
        if (url.pathname.endsWith('/audio/speech')) return w.tts.shift() ?? new Response(new Uint8Array(500), { status: 200 })
        const next = w.ai.shift()
        if (!next) throw new Error('unexpected AI call')
        return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(next) }] }], usage: { input_tokens: 10, output_tokens: 20 } })
      }
      if (url.pathname === '/auth/v1/user') {
        const auth = headers.get('authorization')
        if (auth === 'Bearer user-token') return Response.json({ id: USER })
        if (auth === 'Bearer other-token') return Response.json({ id: OTHER })
        return new Response(null, { status: 401 })
      }
      if (url.pathname.startsWith('/auth/v1/admin/users/')) return Response.json({})
      if (url.pathname.startsWith('/storage/v1/object/tts/')) return Response.json({ Key: 'x' })
      if (headers.get('apikey') !== 'service-key') return new Response(null, { status: 401 })
      if (url.pathname === '/rest/v1/rpc/ai_budget_status') return Response.json([w.budget])
      if (url.pathname === '/rest/v1/rpc/push_candidates') return Response.json(w.candidates)
      if (url.pathname === '/rest/v1/admins') {
        const id = (url.searchParams.get('user_id') ?? '').replace('eq.', '')
        return Response.json(w.admins.has(id) ? [{ user_id: id }] : [])
      }
      const table = url.pathname.replace('/rest/v1/', '')
      const rows = w.tables[table]
      if (!rows) throw new Error(`unexpected ${method} ${url.pathname}`)
      const matches = (row: Record<string, unknown>) =>
        [...url.searchParams.entries()].every(([k, v]) => {
          if (k === 'select' || k === 'on_conflict') return true
          if (v.startsWith('eq.')) return String(row[k]) === decodeURIComponent(v.slice(3))
          if (v === 'is.null') return row[k] === null || row[k] === undefined
          if (v === 'not.is.null') return row[k] !== null && row[k] !== undefined
          return true
        })
      if (method === 'GET') return Response.json(rows.filter(matches))
      if (method === 'POST') {
        const row = body as Record<string, unknown>
        const key = url.searchParams.get('on_conflict')
        const existing = key ? rows.find((r) => r[key] === row[key]) : undefined
        if (existing) Object.assign(existing, row)
        else rows.push({ id: crypto.randomUUID(), ...(table === 'push_secrets' ? { vapid_public: null, vapid_private: null, cron_secret: 'cron-secret' } : {}), ...row })
        return new Response(null, { status: 201 })
      }
      if (method === 'PATCH') {
        for (const r of rows.filter(matches)) Object.assign(r, body as object)
        return new Response(null, { status: 204 })
      }
      if (method === 'DELETE') {
        w.tables[table] = rows.filter((r) => !matches(r))
        return new Response(null, { status: 204 })
      }
      throw new Error('unexpected')
    },
  }
  return w
}

let w: World
beforeEach(() => {
  w = world()
})

const post = (path: string, body: unknown, token: string | null = 'user-token') =>
  new Request(`https://project.test/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })

const TTS_ENV = { ...BASE, ttsApiKey: 'tts-key', ttsBaseUrl: 'https://ai.test/v1', ttsModel: 'tts-model', voiceFemale: 'nova', voiceMale: 'onyx', timeoutMs: 50 }

describe('speech (tts)', () => {
  test('only short German text is accepted', () => {
    expect(normalizeSpeechText('  Guten   Morgen! ')).toBe('Guten Morgen!')
    expect(normalizeSpeechText('سلام')).toBeNull()
    expect(normalizeSpeechText('x'.repeat(301))).toBeNull()
    expect(normalizeSpeechText(42)).toBeNull()
  })

  test('synthesises once, stores the file, then serves the stored copy to everyone', async () => {
    const first = (await (await handleTts(post('tts', { text: 'der Tisch' }), TTS_ENV, w.fetch)).json()) as { url: string; cached: boolean }
    expect(first.cached).toBe(false)
    expect(first.url).toMatch(/^https:\/\/project\.test\/storage\/v1\/object\/public\/tts\/[0-9a-f]{2}\/[0-9a-f]{64}\.mp3$/)
    const speech = w.requests.find((r) => r.url.endsWith('/audio/speech'))!
    expect(speech.headers.get('authorization')).toBe('Bearer tts-key')
    expect(speech.body).toMatchObject({ model: 'tts-model', voice: 'nova', input: 'der Tisch', response_format: 'mp3' })
    expect(w.tables.ai_generation_logs![0]).toMatchObject({ kind: 'tts', input_tokens: 9, user_id: USER })

    const second = (await (await handleTts(post('tts', { text: 'der Tisch' }, 'other-token'), TTS_ENV, w.fetch)).json()) as { url: string; cached: boolean }
    expect(second).toEqual({ url: first.url, cached: true })
    expect(w.requests.filter((r) => r.url.endsWith('/audio/speech')).length).toBe(1)
  })

  test('the male voice is a different file', async () => {
    const a = (await (await handleTts(post('tts', { text: 'Hallo' }), TTS_ENV, w.fetch)).json()) as { url: string }
    const b = (await (await handleTts(post('tts', { text: 'Hallo', voice: 'male' }), TTS_ENV, w.fetch)).json()) as { url: string }
    expect(a.url).not.toBe(b.url)
  })

  test('limits and provider problems are reported clearly', async () => {
    w.budget.user_today = 300
    w.budget.kind_per_day = 300
    expect((await handleTts(post('tts', { text: 'Hallo' }), TTS_ENV, w.fetch)).status).toBe(429)
    w = world()
    w.tts.push(new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }))
    const res = await handleTts(post('tts', { text: 'Hallo' }), TTS_ENV, w.fetch)
    expect(res.status).toBe(503)
    expect((await handleTts(post('tts', { text: 'Hallo' }), { ...TTS_ENV, ttsApiKey: '' }, w.fetch)).status).toBe(500)
    expect((await handleTts(post('tts', { text: 'Hallo' }, null), TTS_ENV, w.fetch)).status).toBe(401)
  })
})

const AI_ENV = { ...BASE, aiApiKey: 'ai-key', aiModel: 'model', aiBaseUrl: 'https://ai.test/v1', aiApiStyle: 'responses' as const }
const goodStory = {
  title_de: 'Ein Tag im Park',
  title_fa: 'یک روز در پارک',
  sentences: [
    { de: 'Anna geht in den Park.', fa: 'آنا به پارک می‌رود.' },
    { de: 'Sie sitzt auf einer Bank.', fa: 'او روی یک نیمکت می‌نشیند.' },
    { de: 'Die Sonne scheint.', fa: 'آفتاب می‌تابد.' },
  ],
  used_words: ['Park', 'Bank', 'Mond'],
}

describe('stories', () => {
  test('validation keeps only words that were given and refuses broken text', () => {
    expect(validateStory(goodStory, ['Park', 'Bank'])!.words).toEqual(['Park', 'Bank'])
    expect(validateStory({ ...goodStory, sentences: goodStory.sentences.slice(0, 2) }, ['Park'])).toBeNull()
    expect(validateStory({ ...goodStory, title_fa: 'A day' }, ['Park'])).toBeNull()
  })

  test('writes a story from known words and stores it for the learner', async () => {
    w.ai.push(goodStory)
    const res = await handleStory(post('story', { words: ['Park', 'Bank', 'Sonne', 'سلام'], level: 'A1' }), AI_ENV, w.fetch, async () => {})
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; sentences: unknown[]; words: string[] }
    expect(body.sentences.length).toBe(3)
    expect(w.tables.stories![0]).toMatchObject({ id: body.id, user_id: USER, level: 'A1', words: ['Park', 'Bank'] })
    expect(w.tables.ai_generation_logs![0]).toMatchObject({ kind: 'story', status: 'ok' })
  })

  test('needs a few words, respects the daily allowance and retries one unusable answer', async () => {
    expect((await handleStory(post('story', { words: ['Park'] }), AI_ENV, w.fetch, async () => {})).status).toBe(400)
    w.budget.user_today = 3
    expect((await handleStory(post('story', { words: ['Park', 'Bank', 'Sonne'] }), AI_ENV, w.fetch, async () => {})).status).toBe(429)
    w = world()
    w.ai.push({ title_de: '', title_fa: '', sentences: [], used_words: [] }, goodStory)
    expect((await handleStory(post('story', { words: ['Park', 'Bank', 'Sonne'] }), AI_ENV, w.fetch, async () => {})).status).toBe(200)
  })
})

async function subscription(endpoint: string, userId: string) {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { id: crypto.randomUUID(), user_id: userId, endpoint, p256dh: b64urlEncode(raw), auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))), failures: 0 }
}

describe('push reminders', () => {
  test('messages are short and in Persian', () => {
    expect(reminderMessage('daily', 12, 0)).toMatchObject({ body: '۱۲ کارت منتظرت است.', url: '#/study' })
    expect(reminderMessage('streak', 0, 5).body).toContain('۵ روز')
  })

  test('the public key is created once and then reused', async () => {
    const a = (await (await handlePush(post('push', { action: 'public-key' }), BASE, w.fetch)).json()) as { publicKey: string }
    const b = (await (await handlePush(post('push', { action: 'public-key' }), BASE, w.fetch)).json()) as { publicKey: string }
    expect(a.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/)
    expect(b.publicKey).toBe(a.publicKey)
    expect(w.tables.push_secrets!.length).toBe(1)
  })

  test('the scheduler needs its secret, sends reminders, and forgets dead subscriptions', async () => {
    await handlePush(post('push', { action: 'public-key' }), BASE, w.fetch)
    w.tables.push_subscriptions!.push(await subscription('https://push.test/a', USER), await subscription('https://push.test/b', USER))
    w.candidates = [{ user_id: USER, kind: 'daily', due_count: 7, streak: 2 }]
    expect((await handlePush(post('push', { action: 'cron', secret: 'wrong' }, null), BASE, w.fetch)).status).toBe(401)
    w.push = [201, 410]
    const res = (await (await handlePush(post('push', { action: 'cron', secret: 'cron-secret' }, null), BASE, w.fetch)).json()) as { sent: number }
    expect(res.sent).toBe(1)
    expect(w.tables.push_subscriptions!.map((s) => s.endpoint)).toEqual(['https://push.test/a'])
    expect(w.tables.notification_log![0]).toMatchObject({ user_id: USER, kind: 'daily' })
    const sentTo = w.requests.filter((r) => r.url.startsWith('https://push.test/'))
    expect(sentTo[0]!.headers.get('authorization')).toMatch(/^vapid t=/)
  })

  test('only administrators can broadcast, and each announcement goes out once', async () => {
    w.tables.announcements!.push({ id: 'ann-1', title: 'بستهٔ تازه', body: 'لغت‌های محل کار آمد', push_sent_at: null })
    w.tables.user_settings!.push({ user_id: USER, notify_updates: true }, { user_id: OTHER, notify_updates: false })
    w.tables.push_subscriptions!.push(await subscription('https://push.test/me', USER), await subscription('https://push.test/other', OTHER))
    expect((await handlePush(post('push', { action: 'broadcast', announcementId: 'ann-1' }), BASE, w.fetch)).status).toBe(403)
    w.admins.add(USER)
    const res = (await (await handlePush(post('push', { action: 'broadcast', announcementId: 'ann-1' }), BASE, w.fetch)).json()) as { sent: number }
    expect(res.sent).toBe(1) // OTHER switched update messages off
    expect(w.tables.announcements![0]!.push_sent_at).toBeTruthy()
    expect((await handlePush(post('push', { action: 'broadcast', announcementId: 'ann-1' }), BASE, w.fetch)).status).toBe(409)
  })
})

describe('admin actions', () => {
  test('only administrators, never on their own account', async () => {
    expect((await handleAdminActions(post('admin-actions', { action: 'ban', userId: OTHER, banned: true }), BASE, w.fetch)).status).toBe(403)
    w.admins.add(USER)
    expect((await handleAdminActions(post('admin-actions', { action: 'ban', userId: USER, banned: true }), BASE, w.fetch)).status).toBe(400)
  })

  test('ban, unban and delete go to the Auth admin API', async () => {
    w.admins.add(USER)
    expect((await handleAdminActions(post('admin-actions', { action: 'ban', userId: OTHER, banned: true }), BASE, w.fetch)).status).toBe(200)
    const ban = w.requests.find((r) => r.url.includes('/auth/v1/admin/users/'))!
    expect(ban.method).toBe('PUT')
    expect(ban.body).toEqual({ ban_duration: '876000h' })
    expect(w.tables.user_limits![0]).toMatchObject({ user_id: OTHER, blocked: true })
    await handleAdminActions(post('admin-actions', { action: 'ban', userId: OTHER, banned: false }), BASE, w.fetch)
    expect(w.tables.user_limits![0]).toMatchObject({ blocked: false })
    expect((await handleAdminActions(post('admin-actions', { action: 'delete_user', userId: OTHER }), BASE, w.fetch)).status).toBe(200)
    expect(w.requests.some((r) => r.method === 'DELETE' && r.url.endsWith(OTHER))).toBe(true)
  })
})
