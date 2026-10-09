/** Small HTTP helpers shared by the edge functions. No Deno-only APIs: runs under any fetch runtime. */

export interface FunctionEnv {
  supabaseUrl: string
  serviceRoleKey: string
  /** Comma-separated list of allowed browser origins; empty or "*" allows any. */
  allowedOrigins?: string
}

/**
 * Finds the server-side key that may bypass row level security.
 * Older projects expose it as SUPABASE_SERVICE_ROLE_KEY; projects on the newer key system
 * expose a JSON dictionary of secret keys (SUPABASE_SECRET_KEYS) instead.
 */
export function resolveServiceKey(get: (name: string) => string | undefined): string {
  const direct = get('SUPABASE_SERVICE_ROLE_KEY') ?? get('SUPABASE_SECRET_KEY')
  if (direct) return direct
  const raw = get('SUPABASE_SECRET_KEYS')
  if (!raw) return ''
  try {
    const parsed: unknown = JSON.parse(raw)
    const pick = (value: unknown): string => {
      if (typeof value === 'string') return value
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>
        for (const field of ['api_key', 'key', 'value', 'secret']) if (typeof record[field] === 'string') return record[field] as string
      }
      return ''
    }
    if (Array.isArray(parsed)) return parsed.map(pick).find(Boolean) ?? ''
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      return pick(record.default) || Object.values(record).map(pick).find(Boolean) || ''
    }
  } catch {
    // not JSON: some setups store the bare key
    return raw.trim()
  }
  return ''
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export function corsHeaders(req: Request, env: Pick<FunctionEnv, 'allowedOrigins'>): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = (env.allowedOrigins ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const any = allowed.length === 0 || allowed.includes('*')
  const allowOrigin = any ? '*' : allowed.includes(origin) ? origin : allowed[0]!
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export function errorResponse(err: unknown, headers: Record<string, string>): Response {
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status, headers)
  }
  console.error('unhandled error', err instanceof Error ? err.message : String(err))
  return json({ error: { code: 'internal', message: 'Unexpected server error' } }, 500, headers)
}

/** Reads a small JSON body; anything larger than `maxBytes` is rejected before parsing. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > maxBytes) {
    throw new HttpError(413, 'payload_too_large', 'Request body is too large')
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, 'invalid_json', 'Body must be a JSON object')
}

/** Resolves the caller from the bearer token by asking Supabase Auth — never by decoding the JWT ourselves. */
export async function requireUser(req: Request, env: FunctionEnv, fetchImpl: FetchLike): Promise<{ id: string }> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'unauthorized', 'Sign in required')
  let res: Response
  try {
    res = await fetchImpl(`${env.supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.serviceRoleKey },
    })
  } catch {
    throw new HttpError(503, 'auth_unavailable', 'Could not verify the session')
  }
  if (!res.ok) throw new HttpError(401, 'unauthorized', 'Session is invalid or expired')
  const user = (await res.json()) as { id?: unknown }
  if (typeof user.id !== 'string' || !user.id) throw new HttpError(401, 'unauthorized', 'Session is invalid')
  return { id: user.id }
}

/** Minimal PostgREST access with the service role (bypasses RLS — server only). */
export function adminRest(env: FunctionEnv, fetchImpl: FetchLike) {
  const base = `${env.supabaseUrl}/rest/v1`
  const headers = {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
  return {
    async select<T>(path: string): Promise<T[]> {
      const res = await fetchImpl(`${base}/${path}`, { headers })
      if (!res.ok) throw new Error(`select ${path.split('?')[0]} failed: ${res.status}`)
      return (await res.json()) as T[]
    },
    async count(path: string): Promise<number> {
      const res = await fetchImpl(`${base}/${path}`, {
        method: 'HEAD',
        headers: { ...headers, Prefer: 'count=exact' },
      })
      if (!res.ok) throw new Error(`count ${path.split('?')[0]} failed: ${res.status}`)
      const total = (res.headers.get('content-range') ?? '').split('/')[1]
      const n = Number(total)
      if (!Number.isFinite(n)) throw new Error('count: missing content-range')
      return n
    },
    async insert(table: string, row: Record<string, unknown>, upsertOn?: string): Promise<void> {
      const url = upsertOn ? `${base}/${table}?on_conflict=${upsertOn}` : `${base}/${table}`
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: upsertOn ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
        },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(`insert ${table} failed: ${res.status}`)
    },
  }
}
