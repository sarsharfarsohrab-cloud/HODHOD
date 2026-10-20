/**
 * POST /functions/v1/admin-actions — administrators only.
 *
 * { action: "ban", userId, banned: boolean }   blocks or unblocks signing in (Supabase Auth ban)
 * { action: "delete_user", userId }            deletes an account and everything it owns
 *
 * Everything else the admin panel does goes through row level security and the
 * admin_* database functions; only these two need the Auth admin API.
 */
import { isAdmin } from './budget.ts'
import { adminRest, corsHeaders, errorResponse, HttpError, json, readJsonBody, requireUser, type FetchLike, type FunctionEnv } from './http.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleAdminActions(req: Request, env: FunctionEnv, fetchImpl: FetchLike = fetch): Promise<Response> {
  const cors = corsHeaders(req, env)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST')
    if (!env.supabaseUrl || !env.serviceRoleKey) throw new HttpError(500, 'not_configured', 'Server is not configured')
    const user = await requireUser(req, env, fetchImpl)
    const db = adminRest(env, fetchImpl)
    if (!(await isAdmin(db, user.id))) throw new HttpError(403, 'forbidden', 'Administrators only')
    const body = await readJsonBody(req, 1_000)
    const target = typeof body.userId === 'string' && UUID.test(body.userId) ? body.userId : ''
    if (!target) throw new HttpError(400, 'invalid_input', 'userId is required')
    if (target === user.id) throw new HttpError(400, 'invalid_input', 'You cannot do this to your own account')

    const authHeaders = { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' }
    if (body.action === 'ban') {
      const res = await fetchImpl(`${env.supabaseUrl}/auth/v1/admin/users/${target}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ ban_duration: body.banned === true ? '876000h' : 'none' }),
      })
      if (!res.ok) throw new HttpError(502, 'auth_failed', `Auth refused the change (${res.status})`)
      // a banned account also loses access to the AI service at once
      await db.insert('user_limits', { user_id: target, blocked: body.banned === true }, 'user_id').catch(() => undefined)
      return json({ ok: true }, 200, cors)
    }
    if (body.action === 'delete_user') {
      const res = await fetchImpl(`${env.supabaseUrl}/auth/v1/admin/users/${target}`, { method: 'DELETE', headers: authHeaders })
      if (!res.ok && res.status !== 404) throw new HttpError(502, 'auth_failed', `Auth refused the deletion (${res.status})`)
      return json({ ok: true }, 200, cors)
    }
    throw new HttpError(400, 'invalid_input', 'Unknown action')
  } catch (err) {
    return errorResponse(err, cors)
  }
}
