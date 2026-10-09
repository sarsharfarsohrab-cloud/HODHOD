/**
 * The AI function against stand-ins for OpenAI and Supabase.
 * The stand-ins exist only in this file: they let us test timeouts, bad model output
 * and rate limits, which cannot be provoked on the real services.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { handleAnalyzeWord, type AnalyzeEnv } from '../../supabase/functions/_shared/analyzeWord.ts'
import { handleDeleteAccount } from '../../supabase/functions/_shared/deleteAccount.ts'
import { resolveAiSettings } from '../../supabase/functions/_shared/aiProviders.ts'
import { PROMPT_VERSION } from '../../supabase/functions/_shared/prompt.ts'
import { asAiOutput, AUFGEBEN, TISCH } from '../fixtures/words.ts'

const ENV: AnalyzeEnv = {
  supabaseUrl: 'https://project.test',
  serviceRoleKey: 'service-role-test-key',
  aiApiKey: 'openai-test-key',
  aiModel: 'test-model',
  aiBaseUrl: 'https://ai.test/v1',
  aiApiStyle: 'responses',
  timeoutMs: 40,
}
const USER = '00000000-0000-0000-0000-00000000000a'

type AiReply = Response | (() => Response | Promise<Response>) | 'hang' | 'network'

interface World {
  aiReplies: AiReply[]
  aiRequests: Record<string, unknown>[]
  aiAuth: string[]
  cache: Map<string, unknown>
  logs: Record<string, unknown>[]
  counts: { minute: number; day: number; global: number }
  countFails: boolean
  deletedUsers: string[]
  fetch: (input: string, init?: RequestInit) => Promise<Response>
}

const aiJson = (output: unknown, extra: Record<string, unknown> = {}) =>
  Response.json({
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text: typeof output === 'string' ? output : JSON.stringify(output) }] },
    ],
    usage: { input_tokens: 900, output_tokens: 1400 },
    ...extra,
  })

function world(): World {
  const w: World = {
    aiReplies: [],
    aiRequests: [],
    aiAuth: [],
    cache: new Map(),
    logs: [],
    counts: { minute: 0, day: 0, global: 0 },
    countFails: false,
    deletedUsers: [],
    fetch: async (input, init = {}) => {
      const url = new URL(input)
      const headers = new Headers(init.headers)
      if (url.host === 'ai.test') {
        w.aiAuth.push(headers.get('authorization') ?? '')
        w.aiRequests.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        const reply = w.aiReplies.shift()
        if (reply === undefined) throw new Error('test: unexpected AI call')
        if (reply === 'network') throw new TypeError('fetch failed')
        if (reply === 'hang') {
          return new Promise<Response>((_, reject) => {
            init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
          })
        }
        return typeof reply === 'function' ? reply() : reply
      }
      if (url.pathname === '/auth/v1/user') {
        return headers.get('authorization') === 'Bearer good-token'
          ? Response.json({ id: USER, email: 'a@example.test' })
          : Response.json({ msg: 'invalid JWT' }, { status: 401 })
      }
      if (url.pathname.startsWith('/auth/v1/admin/users/') && init.method === 'DELETE') {
        if (headers.get('authorization') !== `Bearer ${ENV.serviceRoleKey}`) return new Response(null, { status: 401 })
        w.deletedUsers.push(url.pathname.split('/').pop()!)
        return Response.json({})
      }
      if (headers.get('apikey') !== ENV.serviceRoleKey) return new Response(null, { status: 401 })
      if (url.pathname === '/rest/v1/ai_word_cache') {
        if ((init.method ?? 'GET') === 'GET') {
          const key = `${url.searchParams.get('input_key')}|${url.searchParams.get('prompt_version')}`
          const hit = w.cache.get(key)
          return Response.json(hit ? [{ result: hit }] : [])
        }
        const row = JSON.parse(String(init.body)) as Record<string, unknown>
        w.cache.set(`eq.${row.input_key}|eq.${row.prompt_version}`, row.result)
        return new Response(null, { status: 201 })
      }
      if (url.pathname === '/rest/v1/ai_generation_logs') {
        if (init.method === 'HEAD') {
          if (w.countFails) return new Response(null, { status: 500 })
          const mine = url.searchParams.has('user_id')
          const since = Date.parse((url.searchParams.get('created_at') ?? '').replace('gte.', ''))
          const n = !mine ? w.counts.global : Date.now() - since < 120_000 ? w.counts.minute : w.counts.day
          return new Response(null, { status: 200, headers: { 'content-range': `*/${n}` } })
        }
        w.logs.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return new Response(null, { status: 201 })
      }
      throw new Error(`test: unexpected request ${init.method ?? 'GET'} ${url.pathname}`)
    },
  }
  return w
}

let w: World
beforeEach(() => {
  w = world()
})

const call = (body: unknown, init: { token?: string | null; method?: string; env?: Partial<AnalyzeEnv> } = {}) =>
  handleAnalyzeWord(
    new Request('https://project.test/functions/v1/analyze-word', {
      method: init.method ?? 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://app.test',
        ...(init.token === null ? {} : { authorization: `Bearer ${init.token ?? 'good-token'}` }),
      },
      body: init.method === 'GET' || init.method === 'OPTIONS' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { ...ENV, ...init.env },
    w.fetch,
    async () => {},
  )
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code

describe('analyze-word: access', () => {
  test('answers the CORS preflight without touching anything', async () => {
    const res = await call(null, { method: 'OPTIONS', token: null })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(w.aiRequests.length).toBe(0)
  })
  test('restricts CORS to the configured origin', async () => {
    const res = await call(null, { method: 'OPTIONS', env: { allowedOrigins: 'https://hodhod.example' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('https://hodhod.example')
  })
  test('refuses requests without a valid session — it is not a public AI proxy', async () => {
    for (const token of [null, 'bad-token']) {
      const res = await call({ word: 'Tisch' }, { token })
      expect(res.status).toBe(401)
    }
    expect(w.aiRequests.length).toBe(0)
  })
  test('only POST', async () => {
    expect((await call(null, { method: 'GET' })).status).toBe(405)
  })
})

describe('analyze-word: input', () => {
  test('rejects bad input before spending anything', async () => {
    const cases: [unknown, string][] = [
      [{ word: '' }, 'empty'],
      [{ word: 'aufgeben gehen' }, 'multiple_words'],
      [{ word: 'میز' }, 'wrong_script'],
      [{ word: 'Tisch;--' }, 'invalid_characters'],
      [{ word: 'x'.repeat(41) }, 'too_long'],
      [{}, 'empty'],
    ]
    for (const [body, reason] of cases) {
      const res = await call(body)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: { reason: string } }).error.reason).toBe(reason)
    }
    expect(w.aiRequests.length).toBe(0)
  })
  test('rejects malformed and oversized bodies', async () => {
    expect(await errorCode(await call('{not json'))).toBe('invalid_json')
    expect(await errorCode(await call({ word: 'Tisch', padding: 'x'.repeat(3000) }))).toBe('payload_too_large')
  })
  test('rejects language pairs that have no prompt yet', async () => {
    expect(await errorCode(await call({ word: 'table', targetLanguage: 'en' }))).toBe('unsupported_language')
  })
})

describe('analyze-word: generation', () => {
  test('returns a validated draft and never the model’s raw answer', async () => {
    w.aiReplies.push(aiJson(asAiOutput(AUFGEBEN, { input_note: null, hallucinated_field: 'x' })))
    const res = await call({ word: ' aufgeben ' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toEqual({ status: 'ok', content: AUFGEBEN, inputNote: null, promptVersion: PROMPT_VERSION, model: 'test-model', cached: false })
  })
  test('sends the key server-side, asks for strict structured output and does not store the request', async () => {
    w.aiReplies.push(aiJson(asAiOutput(TISCH)))
    await call({ word: 'Tisch' })
    expect(w.aiAuth).toEqual(['Bearer openai-test-key'])
    const req = w.aiRequests[0]!
    const format = (req.text as { format: Record<string, unknown> }).format
    expect(format.type).toBe('json_schema')
    expect(format.strict).toBe(true)
    expect(req.store).toBe(false)
    expect(JSON.stringify(req.input)).toContain('\\"Tisch\\"')
  })
  test('reports an inflected form together with its lemma', async () => {
    w.aiReplies.push(aiJson(asAiOutput(AUFGEBEN, { input_note: '«gab auf» گذشتهٔ سادهٔ «aufgeben» است.' })))
    const body = (await (await call({ word: 'aufgab' })).json()) as { inputNote: string; content: { lemma: string } }
    expect(body.content.lemma).toBe('aufgeben')
    expect(body.inputNote).toContain('aufgeben')
  })
  test('passes on "not a word", "wrong language" and spelling suggestions', async () => {
    const empty = { lemma: '', meanings: [], noun: null, verb: null, adjective: null, pos: 'other', cefr: 'A1' }
    w.aiReplies.push(aiJson({ ...asAiOutput(TISCH), ...empty, status: 'not_a_word' }))
    expect(await (await call({ word: 'qwrtz' })).json()).toEqual({ status: 'not_a_word', cached: false })
    w.aiReplies.push(aiJson({ ...asAiOutput(TISCH), ...empty, status: 'misspelled', suggestion: 'Straße' }))
    expect(await (await call({ word: 'Strase' })).json()).toEqual({ status: 'misspelled', suggestion: 'Straße', cached: false })
    w.aiReplies.push(aiJson({ ...asAiOutput(TISCH), ...empty, status: 'misspelled', suggestion: 'two words here' }))
    expect(await (await call({ word: 'Strasse' })).json()).toEqual({ status: 'not_a_word', cached: false })
  })
})

describe('analyze-word: other providers (chat-completions format)', () => {
  const chat = { aiApiStyle: 'chat' as const, aiBaseUrl: 'https://ai.test/v1/' }
  const chatJson = (output: unknown, finish = 'stop') =>
    Response.json({ choices: [{ finish_reason: finish, message: { role: 'assistant', content: JSON.stringify(output) } }], usage: { prompt_tokens: 700, completion_tokens: 1200 } })

  test('asks for the same strict schema and reads the answer and token usage', async () => {
    w.aiReplies.push(chatJson(asAiOutput(TISCH)))
    const res = await call({ word: 'Tisch' }, { env: chat })
    expect(((await res.json()) as { content: unknown }).content).toEqual(TISCH)
    const req = w.aiRequests[0]!
    expect((req.response_format as { type: string; json_schema: { strict: boolean } }).type).toBe('json_schema')
    expect((req.response_format as { json_schema: { strict: boolean } }).json_schema.strict).toBe(true)
    expect(Array.isArray(req.messages)).toBe(true)
    expect(w.logs[0]).toMatchObject({ input_tokens: 700, output_tokens: 1200 })
  })
  test('a cut-off or empty answer is invalid here too', async () => {
    w.aiReplies.push(chatJson(asAiOutput(TISCH), 'length'))
    expect(await errorCode(await call({ word: 'Tisch' }, { env: chat }))).toBe('ai_invalid_output')
    w.aiReplies.push(Response.json({ choices: [] }))
    expect(await errorCode(await call({ word: 'Tisch' }, { env: chat }))).toBe('ai_invalid_output')
  })
  test('provider presets and overrides', () => {
    const env = (vars: Record<string, string>) => resolveAiSettings((name) => vars[name])
    expect(env({ AI_API_KEY: 'k' })).toEqual({ aiApiKey: 'k', aiBaseUrl: 'https://api.openai.com/v1', aiApiStyle: 'responses', aiModel: 'gpt-6-luna' })
    expect(env({ AI_PROVIDER: 'Mistral', AI_API_KEY: 'k' })).toMatchObject({ aiBaseUrl: 'https://api.mistral.ai/v1', aiApiStyle: 'chat', aiModel: 'mistral-large-latest' })
    expect(env({ AI_PROVIDER: 'mistral', AI_MODEL: 'mistral-small-latest' }).aiModel).toBe('mistral-small-latest')
    expect(env({ AI_PROVIDER: 'custom', AI_BASE_URL: 'https://llm.example/v1', AI_MODEL: 'm' })).toMatchObject({ aiBaseUrl: 'https://llm.example/v1', aiApiStyle: 'chat' })
    expect(env({ AI_PROVIDER: 'unknown' }).aiBaseUrl).toBe('') // refused later as "not configured"
  })
})

describe('analyze-word: quality control', () => {
  test('repairs an invalid answer once, telling the model what was wrong', async () => {
    const broken = asAiOutput(AUFGEBEN)
    ;(broken.verb as { praeteritum: string[] }).praeteritum = ['gab auf']
    w.aiReplies.push(aiJson(broken), aiJson(asAiOutput(AUFGEBEN)))
    const res = await call({ word: 'aufgeben' })
    expect(res.status).toBe(200)
    expect(w.aiRequests.length).toBe(2)
    expect(JSON.stringify(w.aiRequests[1]!.input)).toContain('verb.praeteritum')
    expect(w.logs.at(-1)!.input_tokens).toBe(1800)
  })
  test('gives up with a clear error after the repair also fails — nothing invalid is returned or cached', async () => {
    const broken = asAiOutput(TISCH, { noun: null })
    w.aiReplies.push(aiJson(broken), aiJson(broken))
    const res = await call({ word: 'Tisch' })
    expect(res.status).toBe(502)
    expect(await errorCode(res)).toBe('ai_invalid_output')
    expect(w.cache.size).toBe(0)
    expect(w.logs.at(-1)!.status).toBe('error')
  })
  test('treats non-JSON, truncated, refused and empty answers as invalid', async () => {
    w.aiReplies.push(aiJson('Sure! Here is the word:'), aiJson('still not json'))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('ai_invalid_output')
    w.aiReplies.push(aiJson(asAiOutput(TISCH), { status: 'incomplete' }))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('ai_invalid_output')
    w.aiReplies.push(Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('ai_invalid_output')
    w.aiReplies.push(Response.json({ status: 'completed', output: [] }))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('ai_invalid_output')
  })
})

describe('analyze-word: failures of the AI service', () => {
  test('times out instead of hanging', async () => {
    w.aiReplies.push('hang')
    const res = await call({ word: 'Tisch' })
    expect(res.status).toBe(504)
    expect(await errorCode(res)).toBe('ai_timeout')
  })
  test('retries server errors and rate limits, then succeeds', async () => {
    w.aiReplies.push(new Response('overloaded', { status: 503 }), new Response('slow down', { status: 429 }), aiJson(asAiOutput(TISCH)))
    expect((await call({ word: 'Tisch' })).status).toBe(200)
    expect(w.aiRequests.length).toBe(3)
  })
  test('retries network failures and reports them when they persist', async () => {
    w.aiReplies.push('network', 'network', 'network')
    const res = await call({ word: 'Tisch' })
    expect(res.status).toBe(502)
    expect(await errorCode(res)).toBe('ai_unavailable')
    expect(w.aiRequests.length).toBe(3)
  })
  test('does not retry configuration problems, and names them', async () => {
    w.aiReplies.push(new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 }))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('not_configured')
    w.aiReplies.push(new Response('{"error":{"message":"The model `x` does not exist"}}', { status: 404 }))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('not_configured')
    w.aiReplies.push(new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }))
    expect(await errorCode(await call({ word: 'Tisch' }))).toBe('ai_quota_exhausted')
    expect(w.aiRequests.length).toBe(3)
    expect(await errorCode(await call({ word: 'Tisch' }, { env: { aiApiKey: '' } }))).toBe('not_configured')
  })
  test('never leaks the upstream error text or any key to the client', async () => {
    w.aiReplies.push(new Response('{"error":{"message":"Incorrect API key provided: openai-test-key"}}', { status: 401 }))
    const text = await (await call({ word: 'Tisch' })).text()
    expect(text).not.toContain('openai-test-key')
    expect(text).not.toContain('service-role')
  })
})

describe('analyze-word: cost control', () => {
  test('the same word is generated once and then served from the shared cache', async () => {
    w.aiReplies.push(aiJson(asAiOutput(TISCH)))
    await call({ word: 'Tisch' })
    const second = (await (await call({ word: ' tisch ' })).json()) as { cached: boolean; content: unknown }
    expect(second.cached).toBe(true)
    expect(second.content).toEqual(TISCH)
    expect(w.aiRequests.length).toBe(1)
    expect(w.logs.map((l) => l.status)).toEqual(['ok', 'cache_hit'])
  })
  test('"regenerate" bypasses the cache on purpose', async () => {
    w.aiReplies.push(aiJson(asAiOutput(TISCH)), aiJson(asAiOutput(TISCH)))
    await call({ word: 'Tisch' })
    const again = (await (await call({ word: 'Tisch', force: true })).json()) as { cached: boolean }
    expect(again.cached).toBe(false)
    expect(w.aiRequests.length).toBe(2)
  })
  test('a cached entry that no longer passes validation is ignored', async () => {
    w.cache.set(`eq.tisch|eq.${PROMPT_VERSION}`, { status: 'ok', content: { lemma: 'Tisch' } })
    w.aiReplies.push(aiJson(asAiOutput(TISCH)))
    const body = (await (await call({ word: 'Tisch' })).json()) as { cached: boolean }
    expect(body.cached).toBe(false)
  })
  test('per-minute, per-day and global limits stop new generations', async () => {
    const scopes: [Partial<World['counts']>, string][] = [[{ minute: 6 }, 'minute'], [{ day: 80 }, 'day'], [{ global: 400 }, 'global']]
    for (const [counts, scope] of scopes) {
      w = world()
      Object.assign(w.counts, counts)
      const res = await call({ word: 'Tisch' })
      expect(res.status).toBe(429)
      expect(((await res.json()) as { error: { scope: string } }).error.scope).toBe(scope)
      expect(w.aiRequests.length).toBe(0)
    }
  })
  test('cached words stay available when the limit is reached', async () => {
    w.cache.set(`eq.tisch|eq.${PROMPT_VERSION}`, { status: 'ok', content: TISCH, inputNote: null, promptVersion: PROMPT_VERSION, model: 'm', cached: false })
    w.counts.day = 999
    expect((await call({ word: 'Tisch' })).status).toBe(200)
  })
  test('if usage cannot be checked the request is refused rather than allowed', async () => {
    w.countFails = true
    const res = await call({ word: 'Tisch' })
    expect(res.status).toBe(503)
    expect(w.aiRequests.length).toBe(0)
  })
  test('usage is logged per user with token counts', async () => {
    w.aiReplies.push(aiJson(asAiOutput(TISCH)))
    await call({ word: 'Tisch' })
    expect(w.logs[0]).toMatchObject({ user_id: USER, kind: 'analyze_word', input: 'Tisch', status: 'ok', prompt_version: PROMPT_VERSION, input_tokens: 900, output_tokens: 1400 })
  })
})

describe('delete-account', () => {
  const del = (body: unknown, token: string | null = 'good-token') =>
    handleDeleteAccount(
      new Request('https://project.test/functions/v1/delete-account', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),
      ENV,
      w.fetch,
    )
  test('needs a session and an explicit confirmation', async () => {
    expect((await del({ confirm: 'DELETE' }, null)).status).toBe(401)
    expect((await del({})).status).toBe(400)
    expect(w.deletedUsers).toEqual([])
  })
  test('deletes exactly the caller', async () => {
    const res = await del({ confirm: 'DELETE', userId: 'someone-else' })
    expect(res.status).toBe(200)
    expect(w.deletedUsers).toEqual([USER])
  })
})
