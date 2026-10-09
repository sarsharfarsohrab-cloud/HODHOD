/**
 * A small client for the three Supabase HTTP APIs this app uses: Auth (GoTrue),
 * the Data API (PostgREST) and Edge Functions. Only the public project URL and the
 * publishable key live here; authorisation is enforced by row level security.
 */
import { AppError, toAppError } from './errors.ts'

export interface SupabaseConfig {
  url: string
  /** Publishable (anon) key — public by design. Never the secret/service-role key. */
  anonKey: string
}

export interface Session {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds. */
  expiresAt: number
  userId: string
  email: string | null
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** 'user' sends the signed-in user's token and refreshes it when needed. */
  auth?: 'user' | 'anon'
  timeoutMs?: number
  signal?: AbortSignal
}

const SESSION_KEY = 'hodhod.session'
const REFRESH_MARGIN_MS = 60_000
const DEFAULT_TIMEOUT_MS = 20_000

type Json = Record<string, unknown>

export class SupabaseClient {
  private current: Session | null = null
  private refreshing: Promise<Session> | null = null
  private listeners = new Set<(session: Session | null) => void>()

  constructor(
    private readonly config: SupabaseConfig,
    private readonly store: KeyValueStore,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.current = this.readStored()
  }

  // --- session ---------------------------------------------------------------

  get session(): Session | null {
    return this.current
  }

  onSessionChange(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Call when another tab changed the stored session. */
  reloadFromStorage(): void {
    const stored = this.readStored()
    if (stored?.accessToken !== this.current?.accessToken) {
      this.current = stored
      this.emit()
    }
  }

  private readStored(): Session | null {
    try {
      const raw = this.store.getItem(SESSION_KEY)
      if (!raw) return null
      const s = JSON.parse(raw) as Partial<Session>
      if (typeof s.accessToken === 'string' && typeof s.refreshToken === 'string' && typeof s.userId === 'string' && typeof s.expiresAt === 'number') {
        return { accessToken: s.accessToken, refreshToken: s.refreshToken, userId: s.userId, expiresAt: s.expiresAt, email: s.email ?? null }
      }
    } catch {
      // corrupted entry: treat as signed out
    }
    return null
  }

  private setSession(session: Session | null): void {
    this.current = session
    try {
      if (session) this.store.setItem(SESSION_KEY, JSON.stringify(session))
      else this.store.removeItem(SESSION_KEY)
    } catch {
      // storage blocked (private mode): the session lives for this page only
    }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.current)
  }

  private sessionFromTokenResponse(data: Json): Session {
    const user = (data.user ?? {}) as Json
    const expiresIn = Number(data.expires_in) || 3600
    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || typeof user.id !== 'string') {
      throw new AppError('server', 'bad_auth_response')
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: this.now() + expiresIn * 1000,
      userId: user.id,
      email: typeof user.email === 'string' ? user.email : null,
    }
  }

  // --- auth --------------------------------------------------------------------

  async signUp(email: string, password: string, displayName: string, redirectTo: string): Promise<{ needsEmailConfirmation: boolean }> {
    const data = await this.json<Json>(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      body: { email, password, data: { display_name: displayName } },
    })
    if (typeof data.access_token === 'string') {
      this.setSession(this.sessionFromTokenResponse(data))
      return { needsEmailConfirmation: false }
    }
    // With e-mail confirmation on, an address that is already registered comes back
    // as a look-alike user without identities.
    if (Array.isArray(data.identities) && data.identities.length === 0) {
      throw new AppError('auth', 'user_already_exists')
    }
    return { needsEmailConfirmation: true }
  }

  async signIn(email: string, password: string): Promise<void> {
    const data = await this.json<Json>('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
    this.setSession(this.sessionFromTokenResponse(data))
  }

  /** Ends the session on this device. Works offline: the local session is always cleared. */
  async signOut(): Promise<void> {
    const session = this.current
    this.setSession(null)
    if (!session) return
    try {
      await this.raw('/auth/v1/logout?scope=local', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        timeoutMs: 5_000,
      })
    } catch {
      // the server-side token simply expires on its own
    }
  }

  async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    await this.json(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: { email } })
  }

  async updatePassword(password: string): Promise<void> {
    await this.json('/auth/v1/user', { method: 'PUT', body: { password }, auth: 'user' })
  }

  /**
   * Completes a sign-in that arrives through the address bar (e-mail confirmation or
   * password-reset link). Returns null when the fragment carries no session.
   */
  async consumeUrlFragment(fragment: string): Promise<{ type: string } | null> {
    const params = new URLSearchParams(fragment.replace(/^#\/?/, ''))
    const description = params.get('error_description')
    if (description || params.get('error')) {
      throw new AppError('auth', params.get('error_code') ?? 'link_invalid', description ?? 'link invalid')
    }
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return null
    const user = await this.json<Json>('/auth/v1/user', { headers: { Authorization: `Bearer ${accessToken}` } })
    if (typeof user.id !== 'string') throw new AppError('auth', 'link_invalid')
    this.setSession({
      accessToken,
      refreshToken,
      expiresAt: this.now() + (Number(params.get('expires_in')) || 3600) * 1000,
      userId: user.id,
      email: typeof user.email === 'string' ? user.email : null,
    })
    return { type: params.get('type') ?? 'signin' }
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    const session = this.current
    if (!session) throw new AppError('auth', 'signed_out')
    if (!forceRefresh && session.expiresAt - this.now() > REFRESH_MARGIN_MS) return session.accessToken
    try {
      return (await this.refresh()).accessToken
    } catch (err) {
      const error = toAppError(err)
      // Offline with a token that is still valid for a moment: keep going with it.
      if (error.transient && !forceRefresh && session.expiresAt > this.now()) return session.accessToken
      throw error
    }
  }

  private refresh(): Promise<Session> {
    if (this.refreshing) return this.refreshing
    const run = async (): Promise<Session> => {
      const session = this.current
      if (!session) throw new AppError('auth', 'signed_out')
      // Another tab may have refreshed already; refresh tokens are single-use.
      const stored = this.readStored()
      if (stored && stored.refreshToken !== session.refreshToken && stored.expiresAt - this.now() > REFRESH_MARGIN_MS) {
        this.current = stored
        this.emit()
        return stored
      }
      try {
        const data = await this.json<Json>('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          body: { refresh_token: session.refreshToken },
        })
        const next = this.sessionFromTokenResponse(data)
        this.setSession(next)
        return next
      } catch (err) {
        const error = toAppError(err)
        if (error.kind === 'auth' || error.kind === 'validation') {
          // the refresh token is no longer accepted: the user has to sign in again
          this.setSession(null)
          throw new AppError('auth', 'session_expired')
        }
        throw error
      }
    }
    this.refreshing = run().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  // --- data API ------------------------------------------------------------------

  async select<T>(table: string, query: Record<string, string>): Promise<T[]> {
    return this.json<T[]>(`/rest/v1/${table}?${new URLSearchParams(query)}`, { auth: 'user' })
  }

  async insert<T>(table: string, row: Json): Promise<T> {
    const rows = await this.json<T[]>(`/rest/v1/${table}?select=*`, {
      method: 'POST',
      body: row,
      auth: 'user',
      headers: { Prefer: 'return=representation' },
    })
    if (!rows[0]) throw new AppError('server', 'insert_returned_nothing')
    return rows[0]
  }

  /** Returns the rows that were changed (empty when the filter matched nothing). */
  async update<T>(table: string, match: Record<string, string>, patch: Json): Promise<T[]> {
    return this.json<T[]>(`/rest/v1/${table}?${new URLSearchParams({ ...match, select: '*' })}`, {
      method: 'PATCH',
      body: patch,
      auth: 'user',
      headers: { Prefer: 'return=representation' },
    })
  }

  async rpc<T>(name: string, args: Json): Promise<T> {
    return this.json<T>(`/rest/v1/rpc/${name}`, { method: 'POST', body: args, auth: 'user' })
  }

  async invoke<T>(name: string, body: Json, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
    return this.json<T>(`/functions/v1/${name}`, {
      method: 'POST',
      body,
      auth: 'user',
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 100_000,
    })
  }

  // --- transport -------------------------------------------------------------------

  private async json<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let res = await this.send(path, options, false)
    if (res.status === 401 && options.auth === 'user') {
      // token expired between our check and the server's: refresh once and retry
      res = await this.send(path, options, true)
    }
    if (!res.ok) throw await errorFromResponse(res, path)
    if (res.status === 204) return undefined as T
    const text = await res.text()
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new AppError('server', 'bad_json')
    }
  }

  private async send(path: string, options: RequestOptions, forceRefresh: boolean): Promise<Response> {
    const headers: Record<string, string> = { ...options.headers }
    if (options.auth === 'user') headers.Authorization = `Bearer ${await this.accessToken(forceRefresh)}`
    return this.raw(path, { ...options, headers })
  }

  private async raw(path: string, options: RequestOptions): Promise<Response> {
    if (options.signal?.aborted) throw new AppError('timeout', 'cancelled')
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort)
    try {
      return await this.fetchFn(`${this.config.url}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.config.anonKey}`,
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
    } catch (err) {
      if (timedOut) throw new AppError('timeout', 'timeout')
      if (options.signal?.aborted) throw new AppError('timeout', 'cancelled')
      throw new AppError('offline', 'network', err instanceof Error ? err.message : 'network')
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }
}

const AUTH_CODES = new Set([
  'invalid_credentials', 'invalid_grant', 'email_not_confirmed', 'user_already_exists', 'email_exists',
  'weak_password', 'signup_disabled', 'user_banned', 'same_password', 'otp_expired',
  'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'bad_jwt', 'user_not_found',
])

async function errorFromResponse(res: Response, path: string): Promise<AppError> {
  let body: Json = {}
  try {
    body = (await res.json()) as Json
  } catch {
    // no JSON body
  }
  const nested = (typeof body.error === 'object' && body.error !== null ? body.error : null) as Json | null
  const code = String(nested?.code ?? body.error_code ?? body.code ?? (typeof body.error === 'string' ? body.error : '') ?? '')
  const message = String(nested?.message ?? body.msg ?? body.message ?? body.error_description ?? res.statusText)
  const detail: Json = nested ? { ...nested } : {}
  const area = path.startsWith('/auth/') ? 'auth' : path.startsWith('/functions/') ? 'function' : 'data'

  if (res.status === 429 || code === 'rate_limited' || code.startsWith('over_')) return new AppError('rate_limit', code || 'rate_limited', message, detail)

  if (area === 'auth') {
    if (code === 'validation_failed' || code === 'email_address_invalid') return new AppError('validation', code, message)
    if (AUTH_CODES.has(code) || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
      return new AppError('auth', code || 'auth_failed', message)
    }
  }

  if (area === 'function') {
    if (res.status === 404 && !nested) return new AppError('not_configured', 'function_missing', message)
    switch (code) {
      case 'invalid_input':
      case 'unsupported_language':
      case 'invalid_json':
      case 'payload_too_large':
      case 'confirmation_required':
        return new AppError('validation', String(nested?.reason ?? code), message, detail)
      case 'not_configured':
      case 'ai_quota_exhausted':
        return new AppError('not_configured', code, message)
      case 'ai_timeout':
        return new AppError('timeout', code, message)
      case 'unauthorized':
        return new AppError('auth', 'session_expired', message)
    }
    if (res.status === 401 || res.status === 403) return new AppError('auth', 'session_expired', message)
    if (res.status === 504 || res.status === 546) return new AppError('timeout', code || 'function_timeout', message)
    return new AppError('server', code || `http_${res.status}`, message)
  }

  if (code === '23505' || res.status === 409) return new AppError('duplicate', code || 'conflict', message)
  if (res.status === 401) return new AppError('auth', 'session_expired', message)
  if (res.status === 403 || code === '42501') return new AppError('auth', 'forbidden', message)
  if (res.status === 404 || code === 'P0002' || code === 'PGRST116') return new AppError('not_found', code || 'not_found', message)
  if (code.startsWith('PGRST2') || code === '42P01' || code === '42883') return new AppError('not_configured', code, message)
  if (res.status >= 500) return new AppError('server', code || `http_${res.status}`, message)
  return new AppError('validation', code || `http_${res.status}`, message)
}
