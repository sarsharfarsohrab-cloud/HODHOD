/**
 * TEST ONLY — the parts of migration 0003 the app talks to (store, feedback, reports,
 * announcements, admin panel), with the same permission rules as the row level
 * security policies: administrators may do everything, learners only their own rows.
 */
import type { FakeSupabase } from './fakeSupabase.ts'

type Row = Record<string, unknown>

export const PLATFORM_TABLES = (): Record<string, Row[]> => ({
  admins: [],
  tts_cache: [],
  stories: [],
  friendships: [],
  packs: [],
  pack_items: [],
  user_packs: [],
  feedback: [],
  card_reports: [],
  announcements: [],
  client_errors: [],
  user_limits: [],
  ai_credit_entries: [],
  app_config: [
    { key: 'ai_prices', value: { default: { input: 1.25, output: 10 }, tts: { input: 15, output: 0 } } },
    { key: 'ai_budget', value: { daily_usd: 1.5, new_user_days: 3, new_user_per_day: 30, tts_per_day: 300, stories_per_day: 3 } },
  ],
})

const NAMES = new Set(Object.keys(PLATFORM_TABLES()))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const denied = () => json({ code: '42501', message: 'new row violates row-level security policy' }, 403)

export async function handlePlatform(fake: FakeSupabase, userId: string, name: string, req: Request, url: URL, body: Row | Row[] | null): Promise<Response | null> {
  const t = fake.tables
  const admin = userId === 'service' || t.admins!.some((a) => a.user_id === userId)
  const now = () => new Date(fake.now()).toISOString()
  const args = (body ?? {}) as Row

  // every profile has a friend code (set by a trigger in the real database)
  for (const p of t.profiles!) p.friend_code ??= `FRND${String(t.profiles!.indexOf(p) + 2).padStart(4, '2')}`.replace(/[01]/g, '2')
  const pair = (a: unknown, b: unknown) => t.friendships!.find((f) => (f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a))

  // --- functions -----------------------------------------------------------------
  if (name.startsWith('rpc/')) {
    const fn = name.slice(4)
    const adminOnly = () => (admin ? null : json({ code: '42501', message: 'not allowed' }, 403))
    switch (fn) {
      case 'is_admin':
        return json(admin)
      case 'store_packs':
        return json(
          t.packs!
            .filter((p) => p.published || admin)
            .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.title).localeCompare(String(b.title)))
            .map((p) => {
              const ready = t.pack_items!.filter((i) => i.pack_id === p.id && i.status === 'ready')
              const own = t.user_packs!.find((u) => u.pack_id === p.id && u.user_id === userId)
              return { ...p, items: ready.length, lessons: ready.reduce((m, i) => Math.max(m, Number(i.lesson)), 0), owned: own !== undefined, added_at: own?.added_at ?? null }
            }),
        )
      case 'start_pack_lesson': {
        const pack = t.packs!.find((p) => p.id === args.p_pack && p.published)
        if (!pack) return json({ code: 'P0002', message: 'pack not found' }, 404)
        if (!t.user_packs!.some((u) => u.pack_id === pack.id && u.user_id === userId)) t.user_packs!.push({ user_id: userId, pack_id: pack.id, added_at: now() })
        let added = 0
        const items = t.pack_items!.filter((i) => i.pack_id === pack.id && i.lesson === args.p_lesson && i.status === 'ready').sort((a, b) => Number(a.position) - Number(b.position))
        for (const item of items) {
          const row: Row = {
            user_id: userId, target_language: 'de', native_language: 'fa', lemma: item.lemma, normalized_lemma: item.normalized_lemma, pos: item.pos,
            cefr: item.cefr, primary_meaning: item.primary_meaning, content: item.content, content_version: 2, source: 'pack',
            tags: [String(pack.title).slice(0, 30)], pack_id: pack.id, pack_item_id: item.id, deleted_at: null, is_favorite: false,
          }
          if (fake.duplicateWord(row)) continue
          const stamp = fake.stamp()
          const word = { id: fake.id(), ...row, created_at: stamp, updated_at: stamp }
          t.words!.push(word)
          fake.createCard(userId, String(word.id), 'recognition')
          added++
        }
        return json(added)
      }
      case 'import_words': {
        const list = args.p_words as Row[]
        if (!Array.isArray(list) || list.length > 500) return json({ code: '22023', message: 'invalid import' }, 400)
        let added = 0
        for (const w of list) {
          const row: Row = { user_id: userId, target_language: 'de', native_language: 'fa', cefr: null, content_version: 1, tags: [], ...w, source: 'import', deleted_at: null, is_favorite: false }
          if (fake.duplicateWord(row)) continue
          const stamp = fake.stamp()
          const word = { id: fake.id(), ...row, created_at: stamp, updated_at: stamp }
          t.words!.push(word)
          fake.createCard(userId, String(word.id), 'recognition')
          added++
        }
        return json(added)
      }
      case 'friend_request': {
        const other = t.profiles!.find((p) => p.friend_code === String(args.p_code).trim().toUpperCase())
        if (!other) return json('not_found')
        if (other.id === userId) return json('self')
        const existing = pair(userId, other.id)
        if (existing) {
          if (existing.status === 'pending' && existing.addressee === userId) {
            existing.status = 'accepted'
            return json('accepted')
          }
          return json('exists')
        }
        t.friendships!.push({ id: fake.id(), requester: userId, addressee: other.id, status: 'pending', created_at: now() })
        return json('sent')
      }
      case 'friend_respond': {
        const f = t.friendships!.find((x) => x.id === args.p_id && x.addressee === userId && x.status === 'pending')
        if (f && args.p_accept) f.status = 'accepted'
        else if (f) t.friendships = t.friendships!.filter((x) => x !== f)
        return new Response(null, { status: 204 })
      }
      case 'friend_remove':
        t.friendships = t.friendships!.filter((x) => !(x.id === args.p_id && (x.requester === userId || x.addressee === userId)))
        return new Response(null, { status: 204 })
      case 'friend_board': {
        const people: { fid: unknown; uid: unknown; status: unknown; incoming: boolean }[] = [{ fid: null, uid: userId, status: 'accepted', incoming: false }]
        for (const f of t.friendships!) {
          if (f.requester !== userId && f.addressee !== userId) continue
          people.push({ fid: f.id, uid: f.requester === userId ? f.addressee : f.requester, status: f.status, incoming: f.addressee === userId && f.status === 'pending' })
        }
        return json(
          people.map((p) => {
            const ok = p.status === 'accepted'
            const reviews = t.review_events!.filter((e) => e.user_id === p.uid && !e.undone_at)
            return {
              friendship_id: p.fid, user_id: p.uid, display_name: t.profiles!.find((x) => x.id === p.uid)?.display_name ?? null, is_me: p.uid === userId,
              status: p.status, incoming: p.incoming, streak: ok && reviews.length > 0 ? 1 : 0, week_reviews: ok ? reviews.length : 0,
              learned: ok ? t.cards!.filter((c) => c.user_id === p.uid && c.state === 'review').length : 0,
            }
          }),
        )
      }
      case 'log_client_error':
        t.client_errors!.push({ id: fake.id(), user_id: userId, message: args.p_message, stack: args.p_stack, url: args.p_url, app_version: args.p_version, user_agent: args.p_agent, created_at: now() })
        return json(true)
      case 'admin_overview':
        return (
          adminOnly() ??
          json({
            users: fake.users.length, users_7d: fake.users.length, active_today: 0, active_7d: 0, words: t.words!.filter((w) => !w.deleted_at).length,
            reviews_today: t.review_events!.length, reviews_7d: t.review_events!.length, ai_calls_today: t.ai_generation_logs!.length,
            cost_today: spent(fake), cost_7d: spent(fake), cost_30d: spent(fake),
            feedback_new: t.feedback!.filter((f) => f.status === 'new').length, reports_new: t.card_reports!.filter((r) => r.status === 'new').length,
            errors_24h: t.client_errors!.length, push_subscribers: 0,
          })
        )
      case 'admin_ai_budget': {
        const denied = adminOnly()
        if (denied) return denied
        const entries = [...t.ai_credit_entries!].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        const balance = [...entries].reverse().find((e) => e.kind === 'balance')
        const since = balance?.created_at ?? entries[0]?.created_at ?? null
        const base = balance ? Number(balance.amount_usd) : 0
        const topups = entries.filter((e) => e.kind === 'topup' && (!since || String(e.created_at) >= String(since))).reduce((n, e) => n + Number(e.amount_usd), 0)
        const cost = since ? spent(fake) : 0
        return json({ since, credit: base + topups, spent: cost, remaining: base + topups - cost, avg_card_cost: 0.0153, daily: [] })
      }
      case 'admin_users':
        return (
          adminOnly() ??
          json(
            fake.users.map((u) => {
              const limit = t.user_limits!.find((l) => l.user_id === u.id)
              return {
                user_id: u.id, email: u.email, display_name: t.profiles!.find((p) => p.id === u.id)?.display_name ?? null, created_at: now(), last_sign_in_at: null,
                last_active_at: null, words: t.words!.filter((w) => w.user_id === u.id && !w.deleted_at).length, reviews_30d: 0, ai_calls_30d: 0, cost_30d: 0, packs: 0,
                ai_per_day: limit?.ai_per_day ?? null, blocked: limit?.blocked === true, is_admin: t.admins!.some((a) => a.user_id === u.id), banned: u.meta.banned === true,
                total: fake.users.length,
              }
            }),
          )
        )
      case 'admin_set_limit': {
        const denied = adminOnly()
        if (denied) return denied
        const existing = t.user_limits!.find((l) => l.user_id === args.p_user)
        const row = { user_id: args.p_user, ai_per_day: args.p_ai_per_day ?? null, blocked: args.p_blocked === true, note: args.p_note ?? null }
        if (existing) Object.assign(existing, row)
        else t.user_limits!.push(row)
        return new Response(null, { status: 204 })
      }
      case 'admin_fix_cache': {
        const denied = adminOnly()
        if (denied) return denied
        let n = 0
        for (const c of t.ai_word_cache!) {
          const result = c.result as Row
          if (c.input_key === String(args.p_input_key).toLowerCase() && result?.status === 'ok') {
            c.result = { ...result, content: args.p_content }
            n++
          }
        }
        return json(n)
      }
      default:
        return null
    }
  }

  if (!NAMES.has(name)) return null
  const table = t[name]!

  // --- who may see a row --------------------------------------------------------------
  const readable = (r: Row): boolean => {
    if (admin) return true
    switch (name) {
      case 'packs':
      case 'announcements':
        return r.published === true
      case 'pack_items':
        return r.status === 'ready' && t.packs!.some((p) => p.id === r.pack_id && p.published)
      case 'feedback':
      case 'card_reports':
      case 'user_packs':
      case 'stories':
      case 'admins':
      case 'user_limits':
        return r.user_id === userId
      case 'app_config':
        return true
      default:
        return false
    }
  }
  const visible = () => table.filter((r) => readable(r) && fake.matches(r, url.searchParams))

  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = visible()
    const order = url.searchParams.get('order')
    if (order) {
      const [key, dir] = order.split(',')[0]!.split('.')
      rows = [...rows].sort((a, b) => {
        const x = a[key!] as string | number
        const y = b[key!] as string | number
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))
        return dir === 'desc' ? -c : c
      })
    }
    const limit = url.searchParams.get('limit')
    if (limit) rows = rows.slice(0, Number(limit))
    return json(rows)
  }

  if (req.method === 'POST' && body) {
    const rows = Array.isArray(body) ? body : [body]
    const own = name === 'feedback' || name === 'card_reports' || name === 'user_packs'
    if (!admin && !own) return denied()
    const conflict = url.searchParams.get('on_conflict')
    const out: Row[] = []
    for (const input of rows) {
      if (own && input.user_id !== undefined && input.user_id !== userId) return denied()
      if (name === 'packs' && t.packs!.some((p) => p.slug === input.slug)) return json({ code: '23505', message: 'duplicate key value violates unique constraint "packs_slug_key"' }, 409)
      if (conflict) {
        const keys = conflict.split(',')
        const same = table.find((r) => keys.every((k) => r[k] === input[k]))
        if (same) {
          Object.assign(same, input, { updated_at: now() })
          out.push(same)
          continue
        }
      }
      const row: Row = { id: fake.id(), created_at: now(), updated_at: now(), ...defaults(name), ...input }
      if (own) row.user_id = userId
      if (name === 'ai_credit_entries') row.created_by = userId
      table.push(row)
      out.push(row)
    }
    return json(out, 201)
  }

  if (req.method === 'PATCH' && body) {
    if (!admin && name !== 'stories') return denied()
    const rows = visible()
    for (const row of rows) Object.assign(row, body, { updated_at: now() })
    return json(rows)
  }

  if (req.method === 'DELETE') {
    if (!admin && name !== 'user_packs') return denied()
    const gone = new Set(visible().map((r) => r.id ?? r.pack_id))
    t[name] = table.filter((r) => !gone.has(r.id ?? r.pack_id))
    if (name === 'packs') t.pack_items = t.pack_items!.filter((i) => !gone.has(i.pack_id))
    return new Response(null, { status: 204 })
  }
  return json({ message: 'method not allowed' }, 405)
}

function defaults(table: string): Row {
  switch (table) {
    case 'packs':
      return { topic: 'general', kind: 'words', level: null, description: null, emoji: null, lesson_size: 12, published: false, sort_order: 0, target_language: 'de', native_language: 'fa' }
    case 'pack_items':
      return { lesson: 1, hint: null, status: 'draft', lemma: null, normalized_lemma: null, pos: null, cefr: null, primary_meaning: null, content: null }
    case 'feedback':
      return { context: {}, status: 'new' }
    case 'card_reports':
      return { status: 'new', resolved_at: null, message: null }
    case 'announcements':
      return { published: true, push_sent_at: null, body: null }
    case 'ai_credit_entries':
      return { kind: 'topup', note: null }
    default:
      return {}
  }
}

/** Dollars spent according to the logs (the default price table of the migration). */
function spent(fake: FakeSupabase): number {
  return fake.tables.ai_generation_logs!.reduce((n, l) => n + (Number(l.input_tokens) || 0) * 1.25e-6 + (Number(l.output_tokens) || 0) * 10e-6, 0)
}
