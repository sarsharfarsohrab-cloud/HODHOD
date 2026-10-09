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
import { validateWordInput } from './inputRules.ts'
import {
  AI_OUTPUT_SCHEMA,
  AI_STATUS,
  aiOutputToContentInput,
  buildMessages,
  buildRepairMessage,
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

interface Usage {
  inputTokens: number
  outputTokens: number
}

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

    const cacheFilter =
      `target_language=eq.${pair.target}&native_language=eq.${pair.native}` +
      `&input_key=eq.${encodeURIComponent(input.cacheKey)}&prompt_version=eq.${PROMPT_VERSION}`

    if (!force) {
      const rows = await db
        .select<{ result: AnalyzeResult }>(`ai_word_cache?${cacheFilter}&select=result&limit=1`)
        .catch(() => [])
      const hit = rows[0]?.result
      if (hit && isUsableCachedResult(hit)) {
        await log('cache_hit')
        return json({ ...hit, cached: true }, 200, cors)
      }
    }

    await enforceRateLimits(db, user.id, env)

    if (!env.aiApiKey || !env.aiModel || !env.aiBaseUrl) throw new HttpError(500, 'not_configured', 'The AI service is not configured')

    let outcome: { result: AnalyzeResult; usage: Usage }
    try {
      outcome = await generate(input.value, pair, env, fetchImpl, sleep)
    } catch (err) {
      const code = err instanceof HttpError ? err.code : 'internal'
      await log('error', { error_code: code })
      throw err
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
          input_key: input.cacheKey,
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

function isUsableCachedResult(hit: AnalyzeResult): boolean {
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

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function generate(
  word: string,
  pair: { target: string; native: string },
  env: AnalyzeEnv,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
): Promise<{ result: AnalyzeResult; usage: Usage }> {
  const { system, user } = buildMessages(pair, word)
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const usage: Usage = { inputTokens: 0, outputTokens: 0 }

  // One generation, then at most one controlled repair with the validation errors.
  let lastIssues: ValidationIssue[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callModel(messages, env, fetchImpl, sleep)
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

async function callModel(
  messages: ChatMessage[],
  env: AnalyzeEnv,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
): Promise<{ text: string; usage: Usage }> {
  const base = env.aiBaseUrl.replace(/\/+$/, '')
  const format = { name: 'word_analysis', strict: true, schema: AI_OUTPUT_SCHEMA }
  const url = env.aiApiStyle === 'chat' ? `${base}/chat/completions` : `${base}/responses`
  const payload = JSON.stringify(
    env.aiApiStyle === 'chat'
      ? {
          model: env.aiModel,
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_schema', json_schema: format },
        }
      : {
          model: env.aiModel,
          input: messages,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          store: false,
          text: { format: { type: 'json_schema', ...format } },
        },
  )

  const maxAttempts = 3
  let lastError = new HttpError(502, 'ai_unavailable', 'The AI service did not answer')
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), env.timeoutMs ?? DEFAULTS.timeoutMs)
    let res: Response | null = null
    let body = ''
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.aiApiKey}`, 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      })
      body = await res.text()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // A second long wait would outlive the learner's patience: fail now.
        throw new HttpError(504, 'ai_timeout', 'The AI service took too long')
      }
      res = null
      lastError = new HttpError(502, 'ai_unavailable', 'The AI service could not be reached')
    } finally {
      clearTimeout(timer)
    }

    if (res) {
      if (res.ok) {
        let data: unknown
        try {
          data = JSON.parse(body)
        } catch {
          throw new HttpError(502, 'ai_invalid_output', 'The AI answer was not readable')
        }
        return env.aiApiStyle === 'chat' ? extractChatText(data as Record<string, unknown>) : extractText(data as Record<string, unknown>)
      }
      console.error('ai provider error', res.status, body.slice(0, 300))
      if (res.status === 401 || res.status === 403) {
        throw new HttpError(500, 'not_configured', 'The AI key was rejected')
      }
      if (res.status === 404 || (res.status === 400 && /model/i.test(body))) {
        throw new HttpError(500, 'not_configured', 'The configured AI model is not available')
      }
      if ((res.status === 429 || res.status === 402) && /insufficient_quota|billing|credit|payment/i.test(body)) {
        throw new HttpError(503, 'ai_quota_exhausted', 'The AI account has no credit left')
      }
      lastError = new HttpError(502, 'ai_unavailable', 'The AI service returned an error')
      // Only rate limiting and server errors are worth another try.
      if (res.status !== 429 && res.status < 500) throw lastError
    }
    if (attempt < maxAttempts) await sleep(400 * 2 ** (attempt - 1))
  }
  throw lastError
}

function extractText(data: Record<string, unknown>): { text: string; usage: Usage } {
  const usageRaw = (data.usage ?? {}) as Record<string, unknown>
  const usage: Usage = {
    inputTokens: Number(usageRaw.input_tokens) || 0,
    outputTokens: Number(usageRaw.output_tokens) || 0,
  }
  if (data.status === 'incomplete') throw new HttpError(502, 'ai_invalid_output', 'The AI answer was cut off')
  const output = Array.isArray(data.output) ? data.output : []
  for (const item of output as Record<string, unknown>[]) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue
    for (const part of item.content as Record<string, unknown>[]) {
      if (part.type === 'refusal') throw new HttpError(502, 'ai_invalid_output', 'The AI declined to answer')
      if (part.type === 'output_text' && typeof part.text === 'string') return { text: part.text, usage }
    }
  }
  throw new HttpError(502, 'ai_invalid_output', 'The AI answer was empty')
}

/** Chat-completions shape (Mistral, and the many providers that follow the same format). */
function extractChatText(data: Record<string, unknown>): { text: string; usage: Usage } {
  const usageRaw = (data.usage ?? {}) as Record<string, unknown>
  const usage: Usage = {
    inputTokens: Number(usageRaw.prompt_tokens) || 0,
    outputTokens: Number(usageRaw.completion_tokens) || 0,
  }
  const choice = (Array.isArray(data.choices) ? data.choices[0] : null) as Record<string, unknown> | null
  if (!choice) throw new HttpError(502, 'ai_invalid_output', 'The AI answer was empty')
  if (choice.finish_reason === 'length') throw new HttpError(502, 'ai_invalid_output', 'The AI answer was cut off')
  const message = (choice.message ?? {}) as Record<string, unknown>
  if (typeof message.refusal === 'string' && message.refusal) throw new HttpError(502, 'ai_invalid_output', 'The AI declined to answer')
  const content = message.content
  if (typeof content === 'string' && content.trim()) return { text: content, usage }
  // some providers return the text as a list of parts
  if (Array.isArray(content)) {
    const text = (content as Record<string, unknown>[]).map((part) => (typeof part.text === 'string' ? part.text : '')).join('')
    if (text.trim()) return { text, usage }
  }
  throw new HttpError(502, 'ai_invalid_output', 'The AI answer was empty')
}
