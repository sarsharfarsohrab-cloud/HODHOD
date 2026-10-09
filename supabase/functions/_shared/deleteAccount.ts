/**
 * POST /functions/v1/delete-account
 *
 * Permanently removes the caller's account. Every user-owned table references
 * auth.users with ON DELETE CASCADE, so deleting the auth user removes words,
 * cards, review history and settings in one transaction. AI usage logs are kept
 * without the user id (ON DELETE SET NULL) for cost accounting.
 */

import { corsHeaders, errorResponse, HttpError, json, readJsonBody, requireUser, type FetchLike, type FunctionEnv } from './http.ts'

export const DELETE_CONFIRMATION = 'DELETE'

export async function handleDeleteAccount(req: Request, env: FunctionEnv, fetchImpl: FetchLike = fetch): Promise<Response> {
  const cors = corsHeaders(req, env)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST')
    if (!env.supabaseUrl || !env.serviceRoleKey) throw new HttpError(500, 'not_configured', 'Server is not configured')
    const user = await requireUser(req, env, fetchImpl)
    const body = await readJsonBody(req, 500)
    if (body.confirm !== DELETE_CONFIRMATION) {
      throw new HttpError(400, 'confirmation_required', 'Deletion must be confirmed explicitly')
    }
    const res = await fetchImpl(`${env.supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
    })
    if (!res.ok) {
      console.error('delete user failed', res.status)
      throw new HttpError(502, 'delete_failed', 'The account could not be deleted')
    }
    return json({ deleted: true }, 200, cors)
  } catch (err) {
    return errorResponse(err, cors)
  }
}
