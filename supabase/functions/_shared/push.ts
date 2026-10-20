/**
 * POST /functions/v1/push
 *
 * { action: "public-key" }            signed-in user → the VAPID public key (created on first use)
 * { action: "test" }                  signed-in user → a test message to their own devices
 * { action: "cron", secret }          the scheduler (pg_cron) → daily and streak reminders
 * { action: "broadcast", announcementId } administrator → an announcement to everyone who allows updates
 */
import { isAdmin } from './budget.ts'
import { adminRest, corsHeaders, errorResponse, HttpError, json, readJsonBody, requireUser, type FetchLike, type FunctionEnv } from './http.ts'
import { generateVapidKeys, sendPush, type PushMessage, type VapidKeys } from './webpush.ts'

export interface PushEnv extends FunctionEnv {
  /** Contact address sent to push services (required by VAPID). */
  pushSubject?: string
  /** Address of the app, used in notification links. */
  appUrl?: string
}

type Db = ReturnType<typeof adminRest>

interface SecretsRow {
  vapid_public: string | null
  vapid_private: JsonWebKey | null
  cron_secret: string
}

interface SubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  failures: number
}

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n)

export function reminderMessage(kind: 'daily' | 'streak', dueCount: number, streak: number): PushMessage {
  if (kind === 'streak') {
    return {
      title: 'روزهای پیاپی‌ات را نگه دار 🔥',
      body: `${fa(streak)} روز پشت سر هم مرور کرده‌ای. امروز هم چند دقیقه وقت بگذار.`,
      url: '#/study',
      tag: 'streak',
    }
  }
  return { title: 'وقت مرور است 🐦', body: `${fa(dueCount)} کارت منتظرت است.`, url: '#/study', tag: 'daily' }
}

async function loadKeys(db: Db): Promise<{ keys: VapidKeys; cronSecret: string }> {
  const rows = await db.select<SecretsRow>('push_secrets?id=eq.1&select=vapid_public,vapid_private,cron_secret')
  let row = rows[0]
  if (!row) {
    await db.insert('push_secrets', { id: 1 }, 'id')
    row = (await db.select<SecretsRow>('push_secrets?id=eq.1&select=vapid_public,vapid_private,cron_secret'))[0]
    if (!row) throw new HttpError(500, 'not_configured', 'Push keys could not be created')
  }
  if (!row.vapid_public || !row.vapid_private) {
    const fresh = await generateVapidKeys()
    // only fill in keys if no other request did it in the meantime
    await db.update('push_secrets?id=eq.1&vapid_public=is.null', { vapid_public: fresh.publicKey, vapid_private: fresh.privateJwk })
    row = (await db.select<SecretsRow>('push_secrets?id=eq.1&select=vapid_public,vapid_private,cron_secret'))[0]!
  }
  return { keys: { publicKey: row.vapid_public!, privateJwk: row.vapid_private! }, cronSecret: row.cron_secret }
}

async function deliver(db: Db, subs: SubscriptionRow[], message: PushMessage, keys: VapidKeys, env: PushEnv, fetchImpl: FetchLike): Promise<number> {
  let sent = 0
  const subject = env.pushSubject || 'mailto:hodhod@example.com'
  const withUrl = { ...message, url: message.url && env.appUrl ? `${env.appUrl.replace(/\/+$/, '')}/${message.url}` : message.url }
  for (const sub of subs) {
    const outcome = await sendPush(sub, withUrl, keys, subject, fetchImpl)
    if (outcome === 'sent') {
      sent++
      await db.update(`push_subscriptions?id=eq.${sub.id}`, { failures: 0, last_success_at: new Date().toISOString() }).catch(() => undefined)
    } else if (outcome === 'gone' || sub.failures >= 9) {
      await db.remove(`push_subscriptions?id=eq.${sub.id}`).catch(() => undefined)
    } else {
      await db.update(`push_subscriptions?id=eq.${sub.id}`, { failures: sub.failures + 1 }).catch(() => undefined)
    }
  }
  return sent
}

const subsOf = (db: Db, filter: string) =>
  db.select<SubscriptionRow>(`push_subscriptions?${filter}&select=id,user_id,endpoint,p256dh,auth,failures`)

export async function handlePush(req: Request, env: PushEnv, fetchImpl: FetchLike = fetch): Promise<Response> {
  const cors = corsHeaders(req, env)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST')
    if (!env.supabaseUrl || !env.serviceRoleKey) throw new HttpError(500, 'not_configured', 'Server is not configured')
    const body = await readJsonBody(req, 2_000)
    const db = adminRest(env, fetchImpl)
    const action = body.action

    if (action === 'cron') {
      const { keys, cronSecret } = await loadKeys(db)
      if (typeof body.secret !== 'string' || body.secret !== cronSecret) throw new HttpError(401, 'unauthorized', 'Wrong scheduler secret')
      const candidates = (await db.rpc<{ user_id: string; kind: 'daily' | 'streak'; due_count: number; streak: number }[]>('push_candidates', { p_now: new Date().toISOString() })) ?? []
      let sent = 0
      for (const c of candidates) {
        const subs = await subsOf(db, `user_id=eq.${c.user_id}`)
        const n = await deliver(db, subs, reminderMessage(c.kind, c.due_count, c.streak), keys, env, fetchImpl)
        if (n > 0) {
          sent += n
          await db.insert('notification_log', { user_id: c.user_id, kind: c.kind }).catch(() => undefined)
        }
      }
      return json({ candidates: candidates.length, sent }, 200, cors)
    }

    const user = await requireUser(req, env, fetchImpl)
    if (action === 'public-key') {
      const { keys } = await loadKeys(db)
      return json({ publicKey: keys.publicKey }, 200, cors)
    }
    if (action === 'test') {
      const { keys } = await loadKeys(db)
      const subs = await subsOf(db, `user_id=eq.${user.id}`)
      const sent = await deliver(db, subs, { title: 'هدهد 🐦', body: 'یادآوری‌ها روشن است. همین‌طوری خبرت می‌کنم.', url: '#/home', tag: 'test' }, keys, env, fetchImpl)
      if (sent > 0) await db.insert('notification_log', { user_id: user.id, kind: 'test' }).catch(() => undefined)
      return json({ sent }, 200, cors)
    }
    if (action === 'broadcast') {
      if (!(await isAdmin(db, user.id))) throw new HttpError(403, 'forbidden', 'Administrators only')
      const id = typeof body.announcementId === 'string' ? body.announcementId : ''
      const rows = await db.select<{ id: string; title: string; body: string | null; push_sent_at: string | null }>(`announcements?id=eq.${encodeURIComponent(id)}&select=id,title,body,push_sent_at`)
      const ann = rows[0]
      if (!ann) throw new HttpError(404, 'not_found', 'Announcement not found')
      if (ann.push_sent_at) throw new HttpError(409, 'already_sent', 'This announcement was already sent')
      const { keys } = await loadKeys(db)
      const allowed = await db.select<{ user_id: string }>('user_settings?notify_updates=eq.true&select=user_id')
      const allowedSet = new Set(allowed.map((r) => r.user_id))
      const subs = (await subsOf(db, 'id=not.is.null')).filter((s) => allowedSet.has(s.user_id))
      const sent = await deliver(db, subs, { title: ann.title, body: ann.body ?? '', url: '#/home', tag: `ann-${ann.id.slice(0, 8)}` }, keys, env, fetchImpl)
      await db.update(`announcements?id=eq.${ann.id}`, { push_sent_at: new Date().toISOString() })
      for (const userId of new Set(subs.map((s) => s.user_id))) {
        await db.insert('notification_log', { user_id: userId, kind: 'announcement', ref: ann.id }).catch(() => undefined)
      }
      return json({ sent }, 200, cors)
    }
    throw new HttpError(400, 'invalid_input', 'Unknown action')
  } catch (err) {
    return errorResponse(err, cors)
  }
}
