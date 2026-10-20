/**
 * POST /functions/v1/analyze-word
 *
 * The only place that talks to OpenAI. The key never leaves the server;
 * the browser sends a word and receives a validated draft.
 */

import {
  adminRest,
  corsHeaders,
  errorResponse,
  HttpError,
  json,
  readJsonBody,
  requireUser,
  type FetchLike,
  type FunctionEnv,
} from './http.ts'
import { callStructured, type ChatMessage, type Usage } from './aiClient.ts'
import { checkAllowance } from './budget.ts'
import { validateWordInput } from './inputRules.ts'
import {
  AI_OUTPUT_SCHEMA,
  AI_STATUS,
  aiOutputToContentInput,
  buildMessages,
  buildRepairMessage,
  COMPATIBLE_PROMPT_VERSIONS,
  isSupportedPair,
  PROMPT_VERSION,
  type AiStatus,
} from './prompt.ts'
import { validateWordContent, type ValidationIssue, type WordContent } from './wordSchema.ts'

export interface AnalyzeEnv extends FunctionEnv {
  /** Secret key of the AI provider. Lives only in the function's environment. */
  aiApiKey: string
  aiModel: string
  /** API root including the version segment, e.g. https://api.openai.com/v1 */
  aiBaseUrl: string
  /**
   * 'responses' — OpenAI Responses API.
   * 'chat' — the chat-completions format that Mistral and most other providers accept.
   */
  aiApiStyle: 'responses' | 'chat'
  /** Fresh generations one user may request per minute / per day. Cache hits are free. */
  perMinuteLimit?: number
  perDayLimit?: number
  /** Fresh generations for all users together per day — a hard ceiling on spend. */
  globalDayLimit?: number
  timeoutMs?: number
}

export type AnalyzeResult =
  | {
      status: 'ok'
      content: WordContent
      inputNote: string | null
      promptVersion: string
      model: string
      cached: boolean
    }
  | { status: 'misspelled'; suggestion: string; cached: boolean }
  | { status: 'not_a_word' | 'wrong_language'; cached: boolean }


// Generous enough for importing a vocabulary list in one go, small enough to cap a runaway bill.
const DEFAULTS = { perMinute: 12, perDay: 200, globalDay: 600, timeoutMs: 60_000 }
const MAX_BODY_BYTES = 2_000
const MAX_OUTPUT_TOKENS = 8_000

export async function handleAnalyzeWord(
  req: Request,
  env: AnalyzeEnv,
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  const cors = corsHeaders(req, env)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST')
    if (!env.supabaseUrl || !env.serviceRoleKey) throw new HttpError(500, 'not_configured', 'Server is not configured')

    const user = await requireUser(req, env, fetchImpl)
    const body = await readJsonBody(req, MAX_BODY_BYTES)

    const input = validateWordInput(body.word)
    if (!input.ok) throw new HttpError(400, 'invalid_input', 'The word is not valid', { reason: input.code })

    const pair = {
      target: typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de',
      native: typeof body.nativeLanguage === 'string' ? body.nativeLanguage : 'fa',
    }
    if (!isSupportedPair(pair)) throw new HttpError(400, 'unsupported_language', 'This language pair is not available yet')
    const force = body.force === true
    // the meaning wanted, when a word pack is prepared from a list with translations
    const hint = typeof body.hint === 'string' ? body.hint.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200) || null : null
    const inputKey = hint ? `${input.cacheKey}|${hint.toLocaleLowerCase('de')}` : input.cacheKey

    const db = adminRest(env, fetchImpl)
    const started = Date.now()
    const log = (status: string, extra: Record<string, unknown> = {}) =>
      db
        .insert('ai_generation_logs', {
          user_id: user.id,
          kind: 'analyze_word',
          input: input.value,
          status,
          prompt_version: PROMPT_VERSION,
          model: env.aiModel,
          duration_ms: Date.now() - started,
          ...extra,
        })
        .catch((e) => console.error('log failed', e instanceof Error ? e.message : e))

    const cacheFilter = (version: string) =>
      `target_language=eq.${pair.target}&native_language=eq.${pair.native}` +
      `&input_key=eq.${encodeURIComponent(inputKey)}&prompt_version=eq.${version}`

    if (!force) {
      // the current prompt first, then analyses made by earlier compatible prompts
      for (const version of [PROMPT_VERSION, ...COMPATIBLE_PROMPT_VERSIONS]) {
        const rows = await db
          .select<{ result: AnalyzeResult }>(`ai_word_cache?${cacheFilter(version)}&select=result&limit=1`)
          .catch(() => [])
        const hit = rows[0]?.result
        if (hit && (version === PROMPT_VERSION || hit.status === 'ok') && isUsableCachedResult(hit, input.cacheKey)) {
          await log('cache_hit')
          return json({ ...upgradeCached(hit), cached: true }, 200, cors)
        }
      }
    }

    const allowance = await checkAllowance(db, user.id, 'analyze_word', env.perDayLimit ?? DEFAULTS.perDay)
    if (!allowance.admin) await enforceRateLimits(db, user.id, env)

    if (!env.aiApiKey || !env.aiModel || !env.aiBaseUrl) throw new HttpError(500, 'not_configured', 'The AI service is not configured')

    let outcome: { result: AnalyzeResult; usage: Usage }
    try {
      outcome = await generate(input.value, pair, env, fetchImpl, sleep, hint)
    } catch (err) {
      const code = err instanceof HttpError ? err.code : 'internal'
      await log('error', { error_code: code })
      throw err
    }

    // "erfolg" → "did you mean Erfolg?" would send the learner round in circles: both have
    // the same cache key. Analyse the suggested spelling straight away instead.
    if (outcome.result.status === 'misspelled' && sameKey(outcome.result.suggestion, input.cacheKey)) {
      try {
        const again = await generate(outcome.result.suggestion, pair, env, fetchImpl, sleep, hint)
        outcome = {
          result: again.result,
          usage: {
            inputTokens: outcome.usage.inputTokens + again.usage.inputTokens,
            outputTokens: outcome.usage.outputTokens + again.usage.outputTokens,
          },
        }
      } catch (err) {
        const code = err instanceof HttpError ? err.code : 'internal'
        await log('error', { error_code: code })
        throw err
      }
      if (outcome.result.status === 'misspelled' && sameKey(outcome.result.suggestion, input.cacheKey)) {
        outcome.result = { status: 'not_a_word', cached: false }
      }
    }

    const { result, usage } = outcome
    await log(result.status === 'ok' ? 'ok' : 'rejected', {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    })
    await db
      .insert(
        'ai_word_cache',
        {
          target_language: pair.target,
          native_language: pair.native,
          input_key: inputKey,
          prompt_version: PROMPT_VERSION,
          model: env.aiModel,
          result,
          updated_at: new Date().toISOString(),
        },
        'target_language,native_language,input_key,prompt_version',
      )
      .catch((e) => console.error('cache write failed', e instanceof Error ? e.message : e))

    return json(result, 200, cors)
  } catch (err) {
    return errorResponse(err, cors)
  }
}

function sameKey(word: string, cacheKey: string): boolean {
  const checked = validateWordInput(word)
  return checked.ok && checked.cacheKey === cacheKey
}

/** Older cached analyses get the fields added since (content version 2). */
function upgradeCached(hit: AnalyzeResult): AnalyzeResult {
  if (hit.status !== 'ok') return hit
  const checked = validateWordContent(hit.content, { mode: 'ai' })
  return checked.ok ? { ...hit, content: checked.value } : hit
}

function isUsableCachedResult(hit: AnalyzeResult, cacheKey: string): boolean {
  // older entries may suggest a spelling that differs only in capital letters
  if (hit.status === 'misspelled') return typeof hit.suggestion === 'string' && !sameKey(hit.suggestion, cacheKey)
  if (hit.status !== 'ok') return AI_STATUS.includes(hit.status)
  // Re-validate: the cache must never be a way around the schema.
  return validateWordContent(hit.content, { mode: 'ai' }).ok
}

async function enforceRateLimits(
  db: ReturnType<typeof adminRest>,
  userId: string,
  env: AnalyzeEnv,
): Promise<void> {
  const perMinute = env.perMinuteLimit ?? DEFAULTS.perMinute
  const perDay = env.perDayLimit ?? DEFAULTS.perDay
  const globalDay = env.globalDayLimit ?? DEFAULTS.globalDay
  const fresh = 'status=in.(ok,rejected,error)&select=id'
  const minuteAgo = new Date(Date.now() - 60_000).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  let lastMinute: number, lastDay: number, allDay: number
  try {
    ;[lastMinute, lastDay, allDay] = await Promise.all([
      db.count(`ai_generation_logs?user_id=eq.${userId}&created_at=gte.${minuteAgo}&${fresh}`),
      db.count(`ai_generation_logs?user_id=eq.${userId}&created_at=gte.${dayAgo}&${fresh}`),
      db.count(`ai_generation_logs?created_at=gte.${dayAgo}&${fresh}`),
    ])
  } catch (e) {
    // Without the counters we cannot bound spend, so we refuse rather than guess.
    console.error('rate limit check failed', e instanceof Error ? e.message : e)
    throw new HttpError(503, 'rate_limit_unavailable', 'Usage could not be checked, try again shortly')
  }
  if (lastMinute >= perMinute) {
    throw new HttpError(429, 'rate_limited', 'Too many requests', { scope: 'minute', retryAfterSeconds: 60 })
  }
  if (lastDay >= perDay) {
    throw new HttpError(429, 'rate_limited', 'Daily limit reached', { scope: 'day', retryAfterSeconds: 3600 })
  }
  if (allDay >= globalDay) {
    throw new HttpError(429, 'rate_limited', 'Daily limit reached', { scope: 'global', retryAfterSeconds: 3600 })
  }
}


async function generate(
  word: string,
  pair: { target: string; native: string },
  env: AnalyzeEnv,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
  hint: string | null = null,
): Promise<{ result: AnalyzeResult; usage: Usage }> {
  const { system, user } = buildMessages(pair, word, hint)
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const usage: Usage = { inputTokens: 0, outputTokens: 0 }

  // One generation, then at most one controlled repair with the validation errors.
  let lastIssues: ValidationIssue[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callStructured(messages, env, { name: 'word_analysis', schema: AI_OUTPUT_SCHEMA, maxOutputTokens: MAX_OUTPUT_TOKENS }, fetchImpl, sleep)
    usage.inputTokens += answer.usage.inputTokens
    usage.outputTokens += answer.usage.outputTokens

    const parsed = interpret(answer.text, env.aiModel)
    if (parsed.ok) return { result: parsed.result, usage }

    lastIssues = parsed.issues
    messages.push({ role: 'assistant', content: answer.text })
    messages.push({ role: 'user', content: buildRepairMessage(parsed.issues) })
  }
  console.error('invalid AI output after repair', JSON.stringify(lastIssues.slice(0, 8)))
  throw new HttpError(502, 'ai_invalid_output', 'The AI answer was not usable')
}

function interpret(
  text: string,
  model: string,
): { ok: true; result: AnalyzeResult } | { ok: false; issues: ValidationIssue[] } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, issues: [{ path: '', code: 'invalid_value' }] }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [{ path: '', code: 'invalid_value' }] }
  }
  const data = raw as Record<string, unknown>
  const status = data.status as AiStatus
  if (!AI_STATUS.includes(status)) return { ok: false, issues: [{ path: 'status', code: 'invalid_value' }] }

  if (status === 'misspelled') {
    const suggestion = validateWordInput(data.suggestion)
    // A "correction" that is not itself a valid single word is no use to the learner.
    if (!suggestion.ok) return { ok: true, result: { status: 'not_a_word', cached: false } }
    return { ok: true, result: { status, suggestion: suggestion.value, cached: false } }
  }
  if (status !== 'ok') return { ok: true, result: { status, cached: false } }

  const checked = validateWordContent(aiOutputToContentInput(data), { mode: 'ai' })
  if (!checked.ok) return { ok: false, issues: checked.issues }
  const inputNote = typeof data.input_note === 'string' && data.input_note.trim() ? data.input_note.trim().slice(0, 300) : null
  return {
    ok: true,
    result: { status: 'ok', content: checked.value, inputNote, promptVersion: PROMPT_VERSION, model, cached: false },
  }
}
