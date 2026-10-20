/**
 * Everything around the word bank that lives on the server only: the pack store,
 * feedback and card reports, error reports, announcements, and the admin panel.
 * Nothing here is cached offline; screens call these when they are opened.
 */
import type { AnalyzeResult } from '../../supabase/functions/_shared/analyzeWord.ts'
import { normalizeLemma, validateWordInput } from '../../supabase/functions/_shared/inputRules.ts'
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { AppError, toAppError } from './errors.ts'
import type { SupabaseClient } from './supabase.ts'

// --- types ----------------------------------------------------------------------

export type PackKind = 'words' | 'expressions' | 'sentences' | 'mixed'
export type PackLevel = 'basic' | 'advanced'

export interface StorePack {
  id: string
  slug: string
  topic: string
  kind: PackKind
  level: PackLevel | null
  title: string
  description: string | null
  emoji: string | null
  lesson_size: number
  published: boolean
  sort_order: number
  items: number
  lessons: number
  owned: boolean
  added_at: string | null
}

export interface PackItem {
  id: string
  pack_id: string
  position: number
  lesson: number
  input: string
  hint: string | null
  status: 'draft' | 'ready' | 'failed'
  lemma: string | null
  normalized_lemma: string | null
  pos: string | null
  cefr: string | null
  primary_meaning: string | null
  content: WordContent | null
}

export type FeedbackKind = 'bug' | 'idea' | 'other'
export type ReportReason = 'meaning' | 'example' | 'grammar' | 'audio' | 'other'

export interface Announcement {
  id: string
  title: string
  body: string | null
  published: boolean
  push_sent_at: string | null
  created_at: string
}

// --- permissions ------------------------------------------------------------------

let adminCheck: { client: SupabaseClient; result: Promise<boolean> } | null = null

/** True for the administrator. Asked once per signed-in session; false on older databases. */
export function isAdmin(client: SupabaseClient): Promise<boolean> {
  if (adminCheck?.client !== client) {
    adminCheck = { client, result: client.rpc<boolean>('is_admin', {}).then((v) => v === true, () => false) }
  }
  return adminCheck.result
}

// --- the store -------------------------------------------------------------------

export async function storePacks(client: SupabaseClient): Promise<StorePack[]> {
  return (await client.rpc<StorePack[]>('store_packs', {})) ?? []
}

const ITEM_FIELDS = 'id,pack_id,position,lesson,input,hint,status,lemma,normalized_lemma,pos,cefr,primary_meaning'

/** The words of a pack (without their full cards), in lesson order. */
export function packItems(client: SupabaseClient, packId: string, options: { full?: boolean; all?: boolean } = {}): Promise<PackItem[]> {
  return client.select<PackItem>('pack_items', {
    select: options.full ? `${ITEM_FIELDS},content` : ITEM_FIELDS,
    pack_id: `eq.${packId}`,
    ...(options.all ? {} : { status: 'eq.ready' }),
    order: 'position.asc',
  })
}

/** Puts one lesson's words into the learner's bank; returns how many were new to them. */
export async function startPackLesson(client: SupabaseClient, packId: string, lesson: number): Promise<number> {
  return Number(await client.rpc<number>('start_pack_lesson', { p_pack: packId, p_lesson: lesson })) || 0
}

// --- feedback ------------------------------------------------------------------------

export async function sendFeedback(client: SupabaseClient, kind: FeedbackKind, message: string, context: Record<string, unknown>): Promise<void> {
  await client.insert('feedback', { kind, message: message.trim().slice(0, 2000), context })
}

export async function reportCard(
  client: SupabaseClient,
  report: { wordId: string | null; content: WordContent; reason: ReportReason; message: string },
): Promise<void> {
  await client.insert('card_reports', {
    word_id: report.wordId,
    lemma: report.content.lemma,
    pos: report.content.pos,
    reason: report.reason,
    message: report.message.trim().slice(0, 1000) || null,
    content: report.content,
  })
}

/** Latest announcements from the team (newest first). */
export function announcements(client: SupabaseClient): Promise<Announcement[]> {
  return client.select<Announcement>('announcements', { select: '*', published: 'eq.true', order: 'created_at.desc', limit: '5' })
}

// --- error reports ---------------------------------------------------------------------

let reportedErrors = 0
const seenErrors = new Set<string>()

/** Sends an unexpected error to the server log; quietly does nothing when that fails. */
export function logClientError(client: SupabaseClient, error: unknown, version: string): void {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error)?.slice(0, 300) ?? '?')
  const key = `${err.message}|${(err.stack ?? '').slice(0, 200)}`
  if (seenErrors.has(key) || reportedErrors >= 20) return
  seenErrors.add(key)
  reportedErrors++
  void client
    .rpc('log_client_error', {
      p_message: err.message.slice(0, 500),
      p_stack: (err.stack ?? '').slice(0, 4000) || null,
      p_url: location.hash.slice(0, 300),
      p_version: version.slice(0, 40),
      p_agent: navigator.userAgent.slice(0, 300),
    })
    .catch(() => undefined)
}

// --- admin -------------------------------------------------------------------------------

export interface AdminOverview {
  users: number
  users_7d: number
  active_today: number
  active_7d: number
  words: number
  reviews_today: number
  reviews_7d: number
  ai_calls_today: number
  cost_today: number
  cost_7d: number
  cost_30d: number
  feedback_new: number
  reports_new: number
  errors_24h: number
  push_subscribers: number
}

export interface AdminBudget {
  since: string | null
  credit: number
  spent: number
  remaining: number
  avg_card_cost: number
  daily: { day: string; cost: number; calls: number }[]
}

export interface AdminUser {
  user_id: string
  email: string
  display_name: string | null
  created_at: string
  last_sign_in_at: string | null
  last_active_at: string | null
  words: number
  reviews_30d: number
  ai_calls_30d: number
  cost_30d: number
  packs: number
  ai_per_day: number | null
  blocked: boolean
  is_admin: boolean
  banned: boolean
  total: number
}

export interface AiPrices {
  [model: string]: { input: number; output: number }
}

export interface AiBudgetConfig {
  daily_usd: number
  new_user_days: number
  new_user_per_day: number
  tts_per_day: number
  stories_per_day: number
}

export interface CreditEntry {
  id: string
  amount_usd: number
  kind: 'topup' | 'balance'
  note: string | null
  created_at: string
}

export interface FeedbackRow {
  id: string
  user_id: string | null
  kind: FeedbackKind
  message: string
  context: Record<string, unknown>
  status: 'new' | 'seen' | 'done'
  created_at: string
}

export interface ReportRow {
  id: string
  user_id: string | null
  word_id: string | null
  lemma: string
  pos: string | null
  reason: ReportReason
  message: string | null
  content: WordContent | null
  status: 'new' | 'fixed' | 'rejected'
  created_at: string
}

export interface ErrorRow {
  id: string
  user_id: string | null
  message: string
  stack: string | null
  url: string | null
  app_version: string | null
  user_agent: string | null
  created_at: string
}

export interface PackRow {
  id: string
  slug: string
  topic: string
  kind: PackKind
  level: PackLevel | null
  title: string
  description: string | null
  emoji: string | null
  lesson_size: number
  published: boolean
  sort_order: number
}

const num = (v: unknown) => Number(v) || 0

export const admin = {
  async overview(client: SupabaseClient): Promise<AdminOverview> {
    const raw = await client.rpc<Record<string, unknown>>('admin_overview', {})
    return Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, num(v)])) as unknown as AdminOverview
  },

  async budget(client: SupabaseClient): Promise<AdminBudget> {
    const raw = await client.rpc<Record<string, unknown>>('admin_ai_budget', {})
    return {
      since: (raw?.since as string | null) ?? null,
      credit: num(raw?.credit),
      spent: num(raw?.spent),
      remaining: num(raw?.remaining),
      avg_card_cost: num(raw?.avg_card_cost),
      daily: ((raw?.daily as { day: string; cost: unknown; calls: unknown }[]) ?? []).map((d) => ({ day: d.day, cost: num(d.cost), calls: num(d.calls) })),
    }
  },

  async users(client: SupabaseClient, search: string, offset = 0, limit = 50): Promise<AdminUser[]> {
    const rows = (await client.rpc<AdminUser[]>('admin_users', { p_search: search.trim() || null, p_limit: limit, p_offset: offset })) ?? []
    return rows.map((r) => ({ ...r, cost_30d: num(r.cost_30d), total: num(r.total) }))
  },

  setLimit(client: SupabaseClient, userId: string, aiPerDay: number | null, blocked: boolean, note: string | null = null): Promise<void> {
    return client.rpc('admin_set_limit', { p_user: userId, p_ai_per_day: aiPerDay, p_blocked: blocked, p_note: note })
  },

  ban(client: SupabaseClient, userId: string, banned: boolean): Promise<void> {
    return client.invoke('admin-actions', { action: 'ban', userId, banned }, { timeoutMs: 30_000 })
  },

  deleteUser(client: SupabaseClient, userId: string): Promise<void> {
    return client.invoke('admin-actions', { action: 'delete_user', userId }, { timeoutMs: 60_000 })
  },

  async config<T>(client: SupabaseClient, key: 'ai_prices' | 'ai_budget'): Promise<T | null> {
    const rows = await client.select<{ value: T }>('app_config', { select: 'value', key: `eq.${key}` })
    return rows[0]?.value ?? null
  },

  async setConfig(client: SupabaseClient, key: 'ai_prices' | 'ai_budget', value: unknown): Promise<void> {
    const rows = await client.update('app_config', { key: `eq.${key}` }, { value })
    if (rows.length === 0) throw new AppError('server', 'config_missing')
  },

  credits(client: SupabaseClient): Promise<CreditEntry[]> {
    return client.select<CreditEntry>('ai_credit_entries', { select: '*', order: 'created_at.desc', limit: '20' })
  },

  addCredit(client: SupabaseClient, kind: 'topup' | 'balance', amount: number, note: string | null): Promise<unknown> {
    return client.insert('ai_credit_entries', { kind, amount_usd: Math.round(amount * 100) / 100, note })
  },

  feedback(client: SupabaseClient): Promise<FeedbackRow[]> {
    return client.select<FeedbackRow>('feedback', { select: '*', order: 'created_at.desc', limit: '100' })
  },

  setFeedbackStatus(client: SupabaseClient, id: string, status: FeedbackRow['status']): Promise<unknown> {
    return client.update('feedback', { id: `eq.${id}` }, { status })
  },

  reports(client: SupabaseClient): Promise<ReportRow[]> {
    return client.select<ReportRow>('card_reports', { select: '*', order: 'created_at.desc', limit: '100' })
  },

  async report(client: SupabaseClient, id: string): Promise<ReportRow | null> {
    return (await client.select<ReportRow>('card_reports', { select: '*', id: `eq.${id}` }))[0] ?? null
  },

  setReportStatus(client: SupabaseClient, id: string, status: ReportRow['status']): Promise<unknown> {
    return client.update('card_reports', { id: `eq.${id}` }, { status, resolved_at: status === 'new' ? null : new Date().toISOString() })
  },

  /**
   * Corrects the shared analysis everyone gets for these inputs (e.g. "Tisch", "der Tisch");
   * returns how many cached answers changed.
   */
  async fixCache(client: SupabaseClient, inputs: readonly string[], content: WordContent): Promise<number> {
    let changed = 0
    const keys = inputs.map((i) => validateWordInput(i)).flatMap((r) => (r.ok ? [r.cacheKey] : []))
    for (const input of new Set(keys)) {
      changed += Number(await client.rpc<number>('admin_fix_cache', { p_input_key: input, p_content: content })) || 0
    }
    return changed
  },

  errors(client: SupabaseClient): Promise<ErrorRow[]> {
    return client.select<ErrorRow>('client_errors', { select: '*', order: 'created_at.desc', limit: '100' })
  },

  announcements(client: SupabaseClient): Promise<Announcement[]> {
    return client.select<Announcement>('announcements', { select: '*', order: 'created_at.desc', limit: '50' })
  },

  addAnnouncement(client: SupabaseClient, title: string, body: string | null): Promise<Announcement> {
    return client.insert<Announcement>('announcements', { title: title.trim(), body: body?.trim() || null })
  },

  setAnnouncementPublished(client: SupabaseClient, id: string, published: boolean): Promise<unknown> {
    return client.update('announcements', { id: `eq.${id}` }, { published })
  },

  async sendAnnouncement(client: SupabaseClient, id: string): Promise<number> {
    const res = await client.invoke<{ sent: number }>('push', { action: 'broadcast', announcementId: id }, { timeoutMs: 120_000 })
    return num(res?.sent)
  },

  packs(client: SupabaseClient): Promise<StorePack[]> {
    return storePacks(client) // administrators see unpublished packs too
  },

  async pack(client: SupabaseClient, id: string): Promise<PackRow | null> {
    return (await client.select<PackRow>('packs', { select: '*', id: `eq.${id}` }))[0] ?? null
  },

  createPack(client: SupabaseClient, pack: Partial<PackRow> & { slug: string; title: string }): Promise<PackRow> {
    return client.insert<PackRow>('packs', pack)
  },

  async updatePack(client: SupabaseClient, id: string, patch: Partial<PackRow>): Promise<void> {
    await client.update('packs', { id: `eq.${id}` }, patch)
  },

  deletePack(client: SupabaseClient, id: string): Promise<void> {
    return client.remove('packs', { id: `eq.${id}` })
  },

  addItems(client: SupabaseClient, rows: Omit<PackItem, 'id' | 'status' | 'lemma' | 'normalized_lemma' | 'pos' | 'cefr' | 'primary_meaning' | 'content'>[]): Promise<PackItem[]> {
    return rows.length === 0 ? Promise.resolve([]) : client.upsert<PackItem>('pack_items', rows as never[], 'pack_id,position')
  },

  async updateItem(client: SupabaseClient, id: string, patch: Partial<PackItem>): Promise<void> {
    await client.update('pack_items', { id: `eq.${id}` }, patch as Record<string, unknown>)
  },

  deleteItem(client: SupabaseClient, id: string): Promise<void> {
    return client.remove('pack_items', { id: `eq.${id}` })
  },

  async item(client: SupabaseClient, id: string): Promise<PackItem | null> {
    return (await client.select<PackItem>('pack_items', { select: `${ITEM_FIELDS},content`, id: `eq.${id}` }))[0] ?? null
  },

  /**
   * Generates one pack item with the AI service (the same shared analysis everyone uses,
   * steered by the optional meaning hint) and stores the result on the item.
   */
  async generateItem(client: SupabaseClient, item: PackItem, languages: { target: string; native: string }): Promise<PackItem> {
    let patch: Partial<PackItem>
    try {
      const result = await client.invoke<AnalyzeResult>(
        'analyze-word',
        { word: item.input, hint: item.hint ?? undefined, targetLanguage: languages.target, nativeLanguage: languages.native },
        { timeoutMs: 100_000 },
      )
      patch = result.status === 'ok' ? itemFromContent(result.content) : { status: 'failed' }
    } catch (err) {
      const error = toAppError(err)
      if (error.kind === 'offline' || error.kind === 'auth' || error.kind === 'rate_limit') throw error
      patch = { status: 'failed' }
    }
    await admin.updateItem(client, item.id, patch)
    return { ...item, ...patch }
  },
}

/** The columns of a pack item that come from its card. */
export function itemFromContent(content: WordContent): Partial<PackItem> {
  return {
    status: 'ready',
    lemma: content.lemma,
    normalized_lemma: normalizeLemma(content.lemma),
    pos: content.pos,
    cefr: content.cefr,
    primary_meaning: content.meanings[0]?.translation ?? null,
    content,
  }
}

/** A pack file from content/packs (the format used to plan the store). */
export interface PackFile {
  packs: {
    slug: string
    topic: string
    level?: PackLevel | null
    kind?: PackKind
    title_fa: string
    description_fa?: string | null
    emoji?: string | null
    items: (string | { text: string; hint?: string | null; register?: string })[]
  }[]
}

export function parsePackFile(text: string): PackFile {
  const data = JSON.parse(text) as PackFile
  if (!data || !Array.isArray(data.packs)) throw new AppError('validation', 'bad_pack_file')
  for (const p of data.packs) {
    if (typeof p.slug !== 'string' || typeof p.title_fa !== 'string' || !Array.isArray(p.items)) throw new AppError('validation', 'bad_pack_file')
  }
  return data
}

/**
 * Parses a pasted list: one entry per line, an optional meaning hint after "|" or a tab
 * ("Bank | نیمکت"). Empty lines and duplicates are dropped.
 */
export function parseItemList(text: string): { input: string; hint: string | null }[] {
  const seen = new Set<string>()
  const out: { input: string; hint: string | null }[] = []
  for (const line of text.split(/\r?\n/)) {
    const [rawInput = '', ...rest] = line.split(/\s*[|\t]\s*/)
    const input = rawInput.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim().slice(0, 200)
    if (!input) continue
    const key = input.toLocaleLowerCase('de')
    if (seen.has(key)) continue
    seen.add(key)
    const hint = rest.join(' ').trim().slice(0, 200)
    out.push({ input, hint: hint || null })
  }
  return out
}

// --- short stories --------------------------------------------------------------------------

export interface StoryRow {
  id: string
  level: string | null
  title_de: string
  title_fa: string
  sentences: { de: string; fa: string }[]
  words: string[]
  read_at: string | null
  created_at: string
}

export const stories = {
  list(client: SupabaseClient): Promise<StoryRow[]> {
    return client.select<StoryRow>('stories', { select: '*', order: 'created_at.desc', limit: '50' })
  },
  async get(client: SupabaseClient, id: string): Promise<StoryRow | null> {
    return (await client.select<StoryRow>('stories', { select: '*', id: `eq.${id}` }))[0] ?? null
  },
  /** Asks the AI for a new story around these words; takes 10–30 seconds. */
  create(client: SupabaseClient, words: string[], level: string): Promise<StoryRow> {
    return client.invoke<StoryRow>('story', { words, level }, { timeoutMs: 120_000 })
  },
  async markRead(client: SupabaseClient, id: string): Promise<void> {
    await client.update('stories', { id: `eq.${id}` }, { read_at: new Date().toISOString() }).catch(() => undefined)
  },
}

// --- friends ------------------------------------------------------------------------------

export interface FriendRow {
  friendship_id: string | null
  user_id: string
  display_name: string | null
  is_me: boolean
  status: 'pending' | 'accepted'
  incoming: boolean
  streak: number
  week_reviews: number
  learned: number
}

export type FriendRequestResult = 'sent' | 'accepted' | 'not_found' | 'self' | 'exists' | 'too_many'

export const friends = {
  async myCode(client: SupabaseClient, userId: string): Promise<string | null> {
    return (await client.select<{ friend_code: string | null }>('profiles', { select: 'friend_code', id: `eq.${userId}` }))[0]?.friend_code ?? null
  },
  async board(client: SupabaseClient, timeZone: string): Promise<FriendRow[]> {
    const rows = (await client.rpc<FriendRow[]>('friend_board', { p_tz: timeZone })) ?? []
    return rows.map((r) => ({ ...r, streak: Number(r.streak) || 0, week_reviews: Number(r.week_reviews) || 0, learned: Number(r.learned) || 0 }))
  },
  request(client: SupabaseClient, code: string): Promise<FriendRequestResult> {
    return client.rpc<FriendRequestResult>('friend_request', { p_code: code.replace(/[\s-]/g, '').toUpperCase() })
  },
  respond(client: SupabaseClient, id: string, accept: boolean): Promise<void> {
    return client.rpc('friend_respond', { p_id: id, p_accept: accept })
  },
  remove(client: SupabaseClient, id: string): Promise<void> {
    return client.rpc('friend_remove', { p_id: id })
  },
}
