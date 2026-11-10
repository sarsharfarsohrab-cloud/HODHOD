/**
 * POST /functions/v1/push
 *
 * { action: "public-key" }            signed-in user → the VAPID public key (created on first use)
 * { action: "test" }                  signed-in user → a test message to their own devices
 * { action: "cron", secret }          the scheduler (pg_cron) → the learners' own reminders and streak warnings
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

interface Texts {
  locale: string
  dailyTitle: string
  daily: (n: string) => string
  /** A reminder the learner set for themselves when no card is waiting: a few minutes with their words. */
  nudge: string
  streakTitle: string
  streak: (n: string) => string
  testTitle: string
  test: string
}

/** Reminder texts in each interface language (the learner's own language). */
const TEXTS: Record<string, Texts> = {
  fa: { locale: 'fa-IR', dailyTitle: 'وقت مرور است 🐦', daily: (n) => `${n} کارت منتظرت است.`, nudge: 'چند دقیقه با واژه‌هایت وقت بگذار.', streakTitle: 'روزهای پیاپی‌ات را نگه دار 🔥', streak: (n) => `${n} روز پشت سر هم مرور کرده‌ای. امروز هم چند دقیقه وقت بگذار.`, testTitle: 'هدهد 🐦', test: 'یادآوری‌ها روشن است. همین‌طوری خبرت می‌کنم.' },
  ar: { locale: 'ar', dailyTitle: 'حان وقت المراجعة 🐦', daily: (n) => `${n} بطاقة بانتظارك.`, nudge: 'خصّص بضع دقائق لكلماتك.', streakTitle: 'حافظ على سلسلة أيامك 🔥', streak: (n) => `راجعت ${n} يومًا متتاليًا. خصّص بضع دقائق اليوم أيضًا.`, testTitle: 'هدهد 🐦', test: 'التذكيرات مفعّلة. هكذا سأخبرك.' },
  de: { locale: 'de-DE', dailyTitle: 'Zeit zum Wiederholen 🐦', daily: (n) => `${n} Karten warten auf dich.`, nudge: 'Nimm dir ein paar Minuten für deine Wörter.', streakTitle: 'Halte deine Serie 🔥', streak: (n) => `Du hast ${n} Tage in Folge geübt. Nimm dir heute auch ein paar Minuten.`, testTitle: 'Hodhod 🐦', test: 'Erinnerungen sind an. So melde ich mich bei dir.' },
  en: { locale: 'en-GB', dailyTitle: 'Time to review 🐦', daily: (n) => `${n} cards are waiting for you.`, nudge: 'Take a few minutes for your words.', streakTitle: 'Keep your streak 🔥', streak: (n) => `You have reviewed ${n} days in a row. Take a few minutes today too.`, testTitle: 'Hodhod 🐦', test: 'Reminders are on. This is how I will let you know.' },
  fr: { locale: 'fr-FR', dailyTitle: 'C’est l’heure de réviser 🐦', daily: (n) => `${n} cartes t’attendent.`, nudge: 'Prends quelques minutes pour tes mots.', streakTitle: 'Garde ta série 🔥', streak: (n) => `Tu as révisé ${n} jours d’affilée. Prends quelques minutes aujourd’hui aussi.`, testTitle: 'Hodhod 🐦', test: 'Les rappels sont activés. C’est ainsi que je te préviendrai.' },
  tr: { locale: 'tr-TR', dailyTitle: 'Tekrar zamanı 🐦', daily: (n) => `${n} kart seni bekliyor.`, nudge: 'Kelimelerine birkaç dakika ayır.', streakTitle: 'Serini koru 🔥', streak: (n) => `${n} gündür arka arkaya tekrar yapıyorsun. Bugün de birkaç dakika ayır.`, testTitle: 'Hodhod 🐦', test: 'Hatırlatmalar açık. Sana böyle haber vereceğim.' },
  uk: { locale: 'uk-UA', dailyTitle: 'Час повторити 🐦', daily: (n) => `На тебе чекають картки: ${n}.`, nudge: 'Приділи кілька хвилин своїм словам.', streakTitle: 'Не перервай серію 🔥', streak: (n) => `Ти повторюєш уже ${n} дн. поспіль. Приділи кілька хвилин і сьогодні.`, testTitle: 'Hodhod 🐦', test: 'Нагадування увімкнено. Ось так я тобі повідомлятиму.' },
  ru: { locale: 'ru-RU', dailyTitle: 'Время повторить 🐦', daily: (n) => `Тебя ждут карточки: ${n}.`, nudge: 'Удели несколько минут своим словам.', streakTitle: 'Сохрани серию 🔥', streak: (n) => `Ты повторяешь уже ${n} дн. подряд. Удели несколько минут и сегодня.`, testTitle: 'Hodhod 🐦', test: 'Напоминания включены. Вот так я буду тебе сообщать.' },
  es: { locale: 'es-ES', dailyTitle: 'Hora de repasar 🐦', daily: (n) => `${n} tarjetas te esperan.`, nudge: 'Dedica unos minutos a tus palabras.', streakTitle: 'Mantén tu racha 🔥', streak: (n) => `Llevas ${n} días seguidos repasando. Dedica unos minutos también hoy.`, testTitle: 'Hodhod 🐦', test: 'Los recordatorios están activados. Así te avisaré.' },
  nl: { locale: 'nl-NL', dailyTitle: 'Tijd om te herhalen 🐦', daily: (n) => `Er wachten ${n} kaarten op je.`, nudge: 'Neem een paar minuten voor je woorden.', streakTitle: 'Houd je reeks vast 🔥', streak: (n) => `Je hebt ${n} dagen op rij herhaald. Neem vandaag ook een paar minuten.`, testTitle: 'Hodhod 🐦', test: 'Herinneringen staan aan. Zo laat ik het je weten.' },
}

const textsFor = (language: string | null | undefined): Texts => TEXTS[language ?? 'fa'] ?? TEXTS.fa!

export function reminderMessage(kind: 'daily' | 'streak', dueCount: number, streak: number, language = 'fa'): PushMessage {
  const x = textsFor(language)
  const n = (v: number) => new Intl.NumberFormat(x.locale).format(v)
  if (kind === 'streak') return { title: x.streakTitle, body: x.streak(n(streak)), url: '#/study', tag: 'streak' }
  return { title: x.dailyTitle, body: dueCount > 0 ? x.daily(n(dueCount)) : x.nudge, url: dueCount > 0 ? '#/study' : '#/home', tag: 'daily' }
}

/** The own language of each user (reminders are written in it). */
async function languagesOf(db: Db, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const rows = await db.select<{ id: string; native_language: string }>(`profiles?id=in.(${userIds.join(',')})&select=id,native_language`).catch(() => [])
  return new Map(rows.map((r) => [r.id, r.native_language]))
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
      const candidates = (await db.rpc<{ user_id: string; kind: 'daily' | 'streak'; due_count: number; streak: number; ref?: string | null }[]>('push_candidates', { p_now: new Date().toISOString() })) ?? []
      let sent = 0
      const languages = await languagesOf(db, [...new Set(candidates.map((c) => c.user_id))])
      for (const c of candidates) {
        const subs = await subsOf(db, `user_id=eq.${c.user_id}`)
        const n = await deliver(db, subs, reminderMessage(c.kind, c.due_count, c.streak, languages.get(c.user_id)), keys, env, fetchImpl)
        if (n > 0) {
          sent += n
          // the reminder's own time, so each chosen time goes out at most once a day
          await db.insert('notification_log', { user_id: c.user_id, kind: c.kind, ref: c.ref ?? null }).catch(() => undefined)
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
      const x = textsFor((await languagesOf(db, [user.id])).get(user.id))
      const sent = await deliver(db, subs, { title: x.testTitle, body: x.test, url: '#/home', tag: 'test' }, keys, env, fetchImpl)
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
