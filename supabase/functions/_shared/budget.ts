/**
 * Spending guard shared by every function that calls a paid AI service.
 *
 * Decides from the database (migration 0003): blocked accounts, per-account daily
 * allowances (smaller for brand-new accounts), and a daily budget in US dollars for
 * the whole project. Administrators preparing word packs are not limited.
 */
import { HttpError, type adminRest } from './http.ts'

type Db = ReturnType<typeof adminRest>

interface BudgetRow {
  spent_today_usd: number | string
  daily_usd: number | string
  user_today: number
  user_limit: number | null
  blocked: boolean
  account_age_hours: number | string
  new_user_days: number
  new_user_per_day: number
  kind_per_day: number | null
}

export interface Allowance {
  admin: boolean
}

export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  try {
    const rows = await db.select<{ user_id: string }>(`admins?user_id=eq.${userId}&select=user_id`)
    return rows.length > 0
  } catch {
    return false // before migration 0003 there are no administrators
  }
}

/**
 * Throws when this account may not start a fresh (paid) generation of `kind` now.
 * `defaultPerDay` applies when neither the account nor the kind has its own limit.
 */
export async function checkAllowance(db: Db, userId: string, kind: string, defaultPerDay: number): Promise<Allowance> {
  let row: BudgetRow | undefined
  try {
    const rows = await db.rpc<BudgetRow[]>('ai_budget_status', { p_user: userId, p_kind: kind })
    row = rows?.[0]
  } catch (e) {
    // Without the numbers we cannot bound spend, so we refuse rather than guess.
    console.error('budget check failed', e instanceof Error ? e.message : e)
    throw new HttpError(503, 'rate_limit_unavailable', 'Usage could not be checked, try again shortly')
  }
  if (!row) return { admin: false } // database not migrated yet: the older per-user limits still apply

  if (row.blocked) throw new HttpError(403, 'account_blocked', 'This account may not use the AI service')
  const admin = await isAdmin(db, userId)
  if (admin) return { admin }

  let limit = row.user_limit ?? row.kind_per_day ?? defaultPerDay
  const ageHours = Number(row.account_age_hours)
  if (row.user_limit === null && kind === 'analyze_word' && ageHours < row.new_user_days * 24) {
    limit = Math.min(limit, row.new_user_per_day)
  }
  if (row.user_today >= limit) {
    throw new HttpError(429, 'rate_limited', 'Daily limit reached', { scope: 'day', retryAfterSeconds: 3600 })
  }
  if (Number(row.spent_today_usd) >= Number(row.daily_usd)) {
    throw new HttpError(429, 'rate_limited', 'Daily budget reached', { scope: 'budget', retryAfterSeconds: 3600 })
  }
  return { admin }
}
