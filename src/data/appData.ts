/**
 * The app's data for one signed-in account.
 *
 * Reads come from memory (loaded from the on-device database, then refreshed from the
 * server). Writes that can safely be replayed — reviews, favourites, archiving, settings —
 * are applied locally at once and queued in an outbox until the server has them.
 * Creating and editing words needs a connection (the first also needs the AI).
 */
import type { AnalyzeResult } from '../../supabase/functions/_shared/analyzeWord.ts'
import { normalizeLemma, stripArticle } from '../../supabase/functions/_shared/inputRules.ts'
import type { PartOfSpeech, WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { addToDay } from '../core/activity.ts'
import { applySchedulingState } from '../core/cards.ts'
import type { SchedulingResult } from '../core/scheduler.ts'
import { dayKey, localTimeZone, shiftDayKey } from '../core/time.ts'
import { DEFAULT_SETTINGS, type Card, type DayActivity, type Profile, type ReviewEvent, type Settings, type Word } from '../core/types.ts'
import { AppError, toAppError } from './errors.ts'
import type { LocalDb } from './localDb.ts'
import {
  activityFromRow,
  cardFromRow,
  cardToReviewJson,
  profileFromRow,
  reviewEventToJson,
  settingsFromRow,
  settingsToRow,
  wordColumns,
  wordFromRow,
  type ActivityRow,
  type CardRow,
  type ProfileRow,
  type SettingsRow,
  type WordRow,
} from './mappers.ts'
import type { SupabaseClient } from './supabase.ts'

type OutboxOp =
  | { id: string; kind: 'review'; event: ReviewEvent; card: Card }
  | { id: string; kind: 'word_patch'; wordId: string; patch: { is_favorite?: boolean; deleted_at?: string | null } }
  | { id: string; kind: 'settings'; patch: Partial<Settings> }

export interface SyncState {
  online: boolean
  syncing: boolean
  /** Changes made on this device that the server does not have yet. */
  pending: number
  lastSyncedAt: string | null
  problem: AppError | null
}

const PAGE = 500
const ACTIVITY_DAYS = 400
const DEFAULT_PROFILE: Profile = { displayName: null, nativeLanguage: 'fa', activeTargetLanguage: 'de' }

export interface AppDataDeps {
  client: SupabaseClient
  db: LocalDb
  userId: string
  now?: () => Date
  isOnline?: () => boolean
  newId?: () => string
}

export class AppData {
  readonly userId: string
  profile: Profile = DEFAULT_PROFILE
  settings: Settings = DEFAULT_SETTINGS
  /** Words in the bank (archived ones are not kept in memory). */
  readonly words = new Map<string, Word>()
  /** The recognition card of each word, by word id. */
  readonly cards = new Map<string, Card>()
  readonly activity = new Map<string, DayActivity>()
  sync: SyncState = { online: true, syncing: false, pending: 0, lastSyncedAt: null, problem: null }
  /** False until the on-device copy has been read. */
  loaded = false
  /** True once this account has been synced with the server at least once on this device. */
  hasSyncedOnce = false

  private readonly client: SupabaseClient
  private readonly db: LocalDb
  private readonly now: () => Date
  private readonly isOnline: () => boolean
  private readonly newId: () => string
  private outbox: OutboxOp[] = []
  private listeners = new Set<() => void>()
  private syncRun: Promise<void> | null = null
  private flushRun: Promise<void> | null = null
  private opCounter = 0
  private closed = false

  constructor(deps: AppDataDeps) {
    this.client = deps.client
    this.db = deps.db
    this.userId = deps.userId
    this.now = deps.now ?? (() => new Date())
    this.isOnline = deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))
    this.newId = deps.newId ?? (() => crypto.randomUUID())
  }

  // --- subscriptions -----------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    if (this.closed) return
    this.sync = { ...this.sync, pending: this.outbox.length, online: this.isOnline() }
    for (const listener of this.listeners) listener()
  }

  close(): void {
    this.closed = true
    this.listeners.clear()
  }

  // --- start-up ------------------------------------------------------------------

  /** Reads the on-device copy. Safe to call offline. */
  async load(): Promise<void> {
    const [words, cards, outbox, settings, profile, activity, lastSyncedAt] = await Promise.all([
      this.db.getAll<Word>('words'),
      this.db.getAll<Card>('cards'),
      this.db.getAll<OutboxOp>('outbox'),
      this.db.getMeta<Settings>('settings'),
      this.db.getMeta<Profile>('profile'),
      this.db.getMeta<[string, DayActivity][]>('activity'),
      this.db.getMeta<string>('lastSyncedAt'),
    ])
    for (const word of words) if (!word.deletedAt) this.words.set(word.id, word)
    for (const card of cards) if (card.cardType === 'recognition') this.cards.set(card.wordId, card)
    this.outbox = outbox.sort((a, b) => (a.id < b.id ? -1 : 1))
    if (settings) this.settings = { ...DEFAULT_SETTINGS, ...settings }
    if (profile) this.profile = profile
    for (const [key, day] of activity ?? []) this.activity.set(key, day)
    this.hasSyncedOnce = Boolean(lastSyncedAt)
    this.sync = { ...this.sync, lastSyncedAt: lastSyncedAt ?? null }
    this.loaded = true
    this.emit()
  }

  // --- reading -------------------------------------------------------------------

  /** Cards of words that are in the bank — the input of the daily queue. */
  activeCards(): Card[] {
    const out: Card[] = []
    for (const [wordId, card] of this.cards) if (this.words.has(wordId)) out.push(card)
    return out
  }

  wordOfCard(card: Card): Word | undefined {
    return this.words.get(card.wordId)
  }

  /**
   * An existing word that the given input or lemma would duplicate.
   * Without a part of speech (before the AI has answered) the comparison ignores case.
   */
  findDuplicate(inputOrLemma: string, pos?: PartOfSpeech, exceptId?: string): Word | undefined {
    const wanted = normalizeLemma(stripArticle(inputOrLemma))
    const loose = wanted.toLocaleLowerCase('de')
    for (const word of this.words.values()) {
      if (word.id === exceptId) continue
      if (pos ? word.normalizedLemma === wanted && word.pos === pos : word.normalizedLemma.toLocaleLowerCase('de') === loose) {
        return word
      }
    }
    return undefined
  }

  today(): DayActivity | undefined {
    return this.activity.get(dayKey(this.now()))
  }

  // --- synchronisation ---------------------------------------------------------------

  /** Uploads pending changes, then downloads everything that changed on the server. */
  syncNow(): Promise<void> {
    if (this.syncRun) return this.syncRun
    this.sync = { ...this.sync, syncing: true }
    this.emit()
    this.syncRun = this.runSync()
      .then(() => {
        this.sync = { ...this.sync, problem: null }
      })
      .catch((err) => {
        this.sync = { ...this.sync, problem: toAppError(err) }
      })
      .finally(() => {
        this.syncRun = null
        this.sync = { ...this.sync, syncing: false }
        this.emit()
      })
    return this.syncRun
  }

  private async runSync(): Promise<void> {
    if (!this.isOnline()) throw new AppError('offline', 'offline')
    await this.flushOutbox()
    if (this.outbox.length > 0) throw new AppError('offline', 'pending_changes')

    const [profileRows, settingsRows] = await Promise.all([
      this.client.select<ProfileRow>('profiles', { select: 'display_name,native_language,active_target_language', id: `eq.${this.userId}` }),
      this.client.select<SettingsRow>('user_settings', { select: '*', user_id: `eq.${this.userId}` }),
    ])
    if (profileRows[0]) this.profile = profileFromRow(profileRows[0])
    if (settingsRows[0]) this.settings = settingsFromRow(settingsRows[0])

    await this.pullWords()
    await this.pullCards()
    await this.pullActivity()

    const stamp = this.now().toISOString()
    await Promise.all([
      this.db.setMeta('profile', this.profile),
      this.db.setMeta('settings', this.settings),
      this.db.setMeta('lastSyncedAt', stamp),
    ])
    this.hasSyncedOnce = true
    this.sync = { ...this.sync, lastSyncedAt: stamp }
  }

  /** Pages through rows changed since the stored cursor, ordered by (updated_at, id). */
  private async pullChanged<Row extends { id: string; updated_at: string }>(
    table: string,
    cursorKey: string,
    apply: (rows: Row[]) => Promise<void>,
  ): Promise<void> {
    let cursor = (await this.db.getMeta<{ at: string; id: string }>(cursorKey)) ?? null
    for (;;) {
      const query: Record<string, string> = { select: '*', order: 'updated_at.asc,id.asc', limit: String(PAGE) }
      if (cursor) query.or = `(updated_at.gt."${cursor.at}",and(updated_at.eq."${cursor.at}",id.gt.${cursor.id}))`
      const rows = await this.client.select<Row>(table, query)
      if (rows.length === 0) break
      await apply(rows)
      const last = rows[rows.length - 1]!
      cursor = { at: last.updated_at, id: last.id }
      await this.db.setMeta(cursorKey, cursor)
      if (rows.length < PAGE) break
    }
  }

  private async pullWords(): Promise<void> {
    await this.pullChanged<WordRow>('words', 'cursor.words', async (rows) => {
      const words = rows.map(wordFromRow)
      await this.db.putMany('words', words)
      for (const word of words) {
        if (word.deletedAt) this.words.delete(word.id)
        else this.words.set(word.id, word)
      }
    })
  }

  private async pullCards(): Promise<void> {
    await this.pullChanged<CardRow>('cards', 'cursor.cards', async (rows) => {
      const cards = rows.map(cardFromRow)
      await this.db.putMany('cards', cards)
      for (const card of cards) if (card.cardType === 'recognition') this.cards.set(card.wordId, card)
    })
  }

  private async pullActivity(): Promise<void> {
    const since = shiftDayKey(dayKey(this.now()), -ACTIVITY_DAYS)
    const rows = await this.client.rpc<ActivityRow[]>('activity_by_day', { p_time_zone: localTimeZone(), p_since: since })
    this.activity.clear()
    for (const row of rows) {
      const [key, day] = activityFromRow(row)
      this.activity.set(key, day)
    }
    // reviews still waiting in the outbox are not in the server totals yet
    for (const op of this.outbox) if (op.kind === 'review') this.countReview(op.event)
    await this.saveActivity()
  }

  private countReview(event: ReviewEvent): void {
    addToDay(this.activity, dayKey(new Date(event.reviewedAt)), {
      reviews: 1,
      again: event.rating === 1 ? 1 : 0,
      newCards: event.stateBefore === 'new' ? 1 : 0,
      durationMs: event.durationMs ?? 0,
    })
  }

  private saveActivity(): Promise<void> {
    return this.db.setMeta('activity', [...this.activity.entries()])
  }

  // --- outbox ------------------------------------------------------------------------

  private async enqueue(op: OutboxOp extends infer O ? (O extends OutboxOp ? Omit<O, 'id'> : never) : never): Promise<void> {
    // sortable id: time, then a counter for operations within the same millisecond
    const id = `${this.now().getTime().toString(36).padStart(9, '0')}-${(this.opCounter++).toString(36).padStart(4, '0')}`
    const full = { ...op, id } as OutboxOp
    this.outbox.push(full)
    await this.db.putMany('outbox', [full])
  }

  /** Sends queued changes in order. Stops at the first one that cannot be delivered right now. */
  flushOutbox(): Promise<void> {
    if (this.flushRun) return this.flushRun
    const run = async () => {
      while (this.outbox.length > 0 && this.isOnline() && !this.closed) {
        const op = this.outbox[0]!
        try {
          await this.deliver(op)
        } catch (err) {
          const error = toAppError(err)
          if (error.transient || error.kind === 'auth' || error.kind === 'not_configured') {
            this.sync = { ...this.sync, problem: error }
            break // keep it and try again later
          }
          // The server refused this change for good: drop it and take the server's version.
          console.warn('change rejected by server', op.kind, error.code)
          await this.discard(op)
          continue
        }
        this.outbox.shift()
        await this.db.remove('outbox', op.id)
        this.emit()
      }
    }
    this.flushRun = run().finally(() => {
      this.flushRun = null
      this.emit()
    })
    return this.flushRun
  }

  private async deliver(op: OutboxOp): Promise<void> {
    switch (op.kind) {
      case 'review': {
        const row = await this.client.rpc<CardRow>('apply_review', {
          p_event: reviewEventToJson(op.event),
          p_card: cardToReviewJson(op.card),
        })
        // Take the server's row unless a later review of the same card is still queued.
        const laterQueued = this.outbox.some((o) => o !== op && o.kind === 'review' && o.card.id === op.card.id)
        if (row && !laterQueued) await this.storeCard(cardFromRow(row))
        return
      }
      case 'word_patch':
        await this.client.update<WordRow>('words', { id: `eq.${op.wordId}` }, op.patch)
        return
      case 'settings':
        await this.client.update<SettingsRow>('user_settings', { user_id: `eq.${this.userId}` }, settingsToRow(op.patch))
        return
    }
  }

  private async discard(op: OutboxOp): Promise<void> {
    this.outbox = this.outbox.filter((o) => o !== op)
    await this.db.remove('outbox', op.id)
    try {
      if (op.kind === 'review') {
        const rows = await this.client.select<CardRow>('cards', { select: '*', id: `eq.${op.card.id}` })
        if (rows[0]) await this.storeCard(cardFromRow(rows[0]))
      } else if (op.kind === 'word_patch') {
        await this.refetchWord(op.wordId)
      }
    } catch {
      // the next full sync repairs it
    }
  }

  private async storeCard(card: Card): Promise<void> {
    if (card.cardType === 'recognition') this.cards.set(card.wordId, card)
    await this.db.putMany('cards', [card])
  }

  private async storeWord(word: Word): Promise<void> {
    if (word.deletedAt) this.words.delete(word.id)
    else this.words.set(word.id, word)
    await this.db.putMany('words', [word])
  }

  private async refetchWord(id: string): Promise<Word | undefined> {
    const rows = await this.client.select<WordRow>('words', { select: '*', id: `eq.${id}` })
    if (!rows[0]) return undefined
    const word = wordFromRow(rows[0])
    await this.storeWord(word)
    return word
  }

  // --- studying ------------------------------------------------------------------------

  /**
   * Records one answer. The card moves forward on this device immediately; the server
   * receives it right away when online, otherwise as soon as the connection returns.
   */
  async recordReview(card: Card, result: SchedulingResult, schedulerVersion: string, durationMs: number | null, sessionId: string | null): Promise<Card> {
    const reviewedAt = this.now()
    const next = applySchedulingState(card, result.next, reviewedAt, schedulerVersion)
    const event: ReviewEvent = {
      id: this.newId(),
      cardId: card.id,
      wordId: card.wordId,
      rating: result.rating,
      reviewedAt: reviewedAt.toISOString(),
      durationMs,
      stateBefore: card.state,
      stateAfter: next.state,
      stabilityBefore: card.stability,
      stabilityAfter: next.stability,
      difficultyBefore: card.difficulty,
      difficultyAfter: next.difficulty,
      elapsedDays: result.elapsedDays,
      scheduledDays: next.scheduledDays,
      dueBefore: card.due,
      dueAfter: next.due,
      schedulerVersion,
      sessionId,
    }
    this.cards.set(card.wordId, next)
    this.countReview(event)
    await Promise.all([this.db.putMany('cards', [next]), this.enqueue({ kind: 'review', event, card: next }), this.saveActivity()])
    this.emit()
    void this.flushOutbox()
    return next
  }

  // --- words -----------------------------------------------------------------------------

  /** Asks the AI service for a draft. Nothing is saved by this call. */
  analyzeWord(word: string, options: { force?: boolean; signal?: AbortSignal } = {}): Promise<AnalyzeResult> {
    if (!this.isOnline()) return Promise.reject(new AppError('offline', 'offline'))
    return this.client.invoke<AnalyzeResult>(
      'analyze-word',
      {
        word,
        targetLanguage: this.profile.activeTargetLanguage,
        nativeLanguage: this.profile.nativeLanguage,
        force: options.force === true,
      },
      { signal: options.signal },
    )
  }

  /** Saves a confirmed draft to the Word Bank. Its card starts as "new" and waits for the daily queue. */
  async saveWord(content: WordContent, meta: { source: 'ai' | 'manual'; promptVersion?: string; model?: string; favorite?: boolean }): Promise<Word> {
    if (!this.isOnline()) throw new AppError('offline', 'offline')
    if (this.findDuplicate(content.lemma, content.pos)) throw new AppError('duplicate', 'duplicate_word')
    const row = await this.client.insert<WordRow>('words', {
      ...wordColumns(content),
      target_language: this.profile.activeTargetLanguage,
      native_language: this.profile.nativeLanguage,
      is_favorite: meta.favorite === true,
      source: meta.source,
      ai_prompt_version: meta.promptVersion ?? null,
      ai_model: meta.model ?? null,
    })
    const word = wordFromRow(row)
    await this.storeWord(word)
    const cards = await this.client.select<CardRow>('cards', { select: '*', word_id: `eq.${word.id}` })
    for (const cardRow of cards) await this.storeCard(cardFromRow(cardRow))
    this.emit()
    return word
  }

  /**
   * Replaces a word's content. Refused if the word was changed elsewhere since this
   * device loaded it — the newer version is fetched instead of being overwritten.
   */
  async updateWordContent(id: string, content: WordContent): Promise<Word> {
    const current = this.words.get(id)
    if (!current) throw new AppError('not_found', 'word_missing')
    if (!this.isOnline()) throw new AppError('offline', 'offline')
    if (this.findDuplicate(content.lemma, content.pos, id)) throw new AppError('duplicate', 'duplicate_word')
    const rows = await this.client.update<WordRow>('words', { id: `eq.${id}`, updated_at: `eq.${current.updatedAt}` }, wordColumns(content))
    if (!rows[0]) {
      await this.refetchWord(id)
      this.emit()
      throw new AppError('conflict', 'word_changed_elsewhere')
    }
    const word = wordFromRow(rows[0])
    await this.storeWord(word)
    this.emit()
    return word
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const word = this.words.get(id)
    if (!word || word.isFavorite === favorite) return
    await this.storeWord({ ...word, isFavorite: favorite })
    await this.enqueue({ kind: 'word_patch', wordId: id, patch: { is_favorite: favorite } })
    this.emit()
    void this.flushOutbox()
  }

  /** Removes words from the bank. Their review history stays in the database. */
  async archiveWords(ids: readonly string[]): Promise<void> {
    const stamp = this.now().toISOString()
    for (const id of ids) {
      const word = this.words.get(id)
      if (!word) continue
      await this.storeWord({ ...word, deletedAt: stamp })
      await this.enqueue({ kind: 'word_patch', wordId: id, patch: { deleted_at: stamp } })
    }
    this.emit()
    void this.flushOutbox()
  }

  // --- settings & account -------------------------------------------------------------------

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch }
    await this.db.setMeta('settings', this.settings)
    const last = this.outbox[this.outbox.length - 1]
    if (last?.kind === 'settings' && this.flushRun === null) {
      // several quick changes travel as one request
      last.patch = { ...last.patch, ...patch }
      await this.db.putMany('outbox', [last])
    } else {
      await this.enqueue({ kind: 'settings', patch })
    }
    this.emit()
    void this.flushOutbox()
  }

  async updateDisplayName(name: string): Promise<void> {
    const displayName = name.trim().slice(0, 60) || null
    const rows = await this.client.update<ProfileRow>('profiles', { id: `eq.${this.userId}` }, { display_name: displayName })
    this.profile = rows[0] ? profileFromRow(rows[0]) : { ...this.profile, displayName }
    await this.db.setMeta('profile', this.profile)
    this.emit()
  }

  /** Everything the account owns, as plain data. Needs a connection for the full review history. */
  async exportData(): Promise<Record<string, unknown>> {
    await this.syncNow()
    const reviews: Record<string, unknown>[] = []
    for (let offset = 0; ; offset += 1000) {
      const page = await this.client.select<Record<string, unknown>>('review_events', {
        select: '*',
        order: 'reviewed_at.asc,id.asc',
        limit: '1000',
        offset: String(offset),
      })
      reviews.push(...page)
      if (page.length < 1000) break
    }
    const allWords = await this.db.getAll<Word>('words')
    const allCards = await this.db.getAll<Card>('cards')
    return {
      format: 'hodhod-export',
      version: 1,
      exportedAt: this.now().toISOString(),
      profile: this.profile,
      settings: this.settings,
      words: allWords,
      cards: allCards,
      reviewEvents: reviews,
    }
  }

  /** Signs out and removes this account's data from the device. */
  async signOut(): Promise<void> {
    await this.flushOutbox().catch(() => undefined)
    this.close()
    await this.db.destroy()
    await this.client.signOut()
  }

  /** Permanently deletes the account and everything it owns on the server. */
  async deleteAccount(): Promise<void> {
    await this.client.invoke('delete-account', { confirm: 'DELETE' }, { timeoutMs: 30_000 })
    this.close()
    await this.db.destroy()
    await this.client.signOut()
  }
}
