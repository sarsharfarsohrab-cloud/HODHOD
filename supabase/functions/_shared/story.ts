/**
 * POST /functions/v1/story   { words: string[], level?: "A1".."C1" }
 *
 * A short story or dialogue written around words the learner already knows, with a
 * Persian translation per sentence. Stored in the learner's "stories".
 */
import { callStructured, type AiEnv, type ChatMessage } from './aiClient.ts'
import { checkAllowance } from './budget.ts'
import { adminRest, corsHeaders, errorResponse, HttpError, json, readJsonBody, requireUser, type FetchLike, type FunctionEnv } from './http.ts'

export interface StoryEnv extends FunctionEnv, AiEnv {}

export interface StorySentence {
  de: string
  fa: string
}

export interface Story {
  id?: string
  title_de: string
  title_fa: string
  sentences: StorySentence[]
  words: string[]
  level: string
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const PERSIAN = /[؀-ۿ]/
const LATIN = /\p{Script=Latin}/u

const STORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title_de', 'title_fa', 'sentences', 'used_words'],
  properties: {
    title_de: { type: 'string' },
    title_fa: { type: 'string' },
    sentences: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['de', 'fa'], properties: { de: { type: 'string' }, fa: { type: 'string' } } },
    },
    used_words: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = `You write short, warm, everyday German reading texts for Persian-speaking learners.
Write ONE short story or dialogue (6 to 10 sentences) at the requested CEFR level, set in daily life in Germany (family, work, shopping, friends, travel, appointments). Use as many of the given words as fit naturally — at least half of them — in any grammatical form; you may add other simple words of the level. Each sentence: natural standard German with correct grammar and punctuation, at most 20 words. Give a faithful, natural Persian translation of every sentence in modern written Persian (Persian script, correct half-spaces). In a dialogue, start lines with the speaker's first name and a colon in both languages. "used_words": the given words you actually used, exactly as given. Titles: short German title and its Persian translation. Nothing violent, sexual or political.`

export function validateStory(raw: unknown, given: string[]): Omit<Story, 'level'> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, max) : '')
  const title_de = clean(r.title_de, 200)
  const title_fa = clean(r.title_fa, 200)
  if (!title_de || !LATIN.test(title_de) || !title_fa || !PERSIAN.test(title_fa)) return null
  const list = Array.isArray(r.sentences) ? r.sentences : []
  const sentences: StorySentence[] = []
  for (const item of list.slice(0, 14)) {
    const s = (item ?? {}) as Record<string, unknown>
    const de = clean(s.de, 300)
    const fa = clean(s.fa, 300)
    if (!de || !fa || PERSIAN.test(de) || !LATIN.test(de) || !PERSIAN.test(fa)) return null
    sentences.push({ de, fa })
  }
  if (sentences.length < 3) return null
  const givenSet = new Set(given.map((w) => w.toLocaleLowerCase('de')))
  const words = (Array.isArray(r.used_words) ? r.used_words : []).map((w) => clean(w, 80)).filter((w) => givenSet.has(w.toLocaleLowerCase('de')))
  return { title_de, title_fa, sentences, words: [...new Set(words)] }
}

export async function handleStory(
  req: Request,
  env: StoryEnv,
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  const cors = corsHeaders(req, env)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST')
    if (!env.supabaseUrl || !env.serviceRoleKey) throw new HttpError(500, 'not_configured', 'Server is not configured')
    const user = await requireUser(req, env, fetchImpl)
    const body = await readJsonBody(req, 4_000)
    const words = (Array.isArray(body.words) ? body.words : [])
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.normalize('NFC').replace(/\s+/g, ' ').trim())
      .filter((w) => w && w.length <= 80 && LATIN.test(w) && !PERSIAN.test(w))
      .slice(0, 40)
    if (words.length < 3) throw new HttpError(400, 'invalid_input', 'At least three known words are needed')
    const level = typeof body.level === 'string' && LEVELS.includes(body.level) ? body.level : 'A2'

    const db = adminRest(env, fetchImpl)
    await checkAllowance(db, user.id, 'story', 3)
    if (!env.aiApiKey || !env.aiModel || !env.aiBaseUrl) throw new HttpError(500, 'not_configured', 'The AI service is not configured')

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Level: ${level}\nWords: ${JSON.stringify(words)}` },
    ]
    let story: Omit<Story, 'level'> | null = null
    let usage = { inputTokens: 0, outputTokens: 0 }
    for (let attempt = 0; attempt < 2 && !story; attempt++) {
      const answer = await callStructured(messages, env, { name: 'story', schema: STORY_SCHEMA, maxOutputTokens: 3_000 }, fetchImpl, sleep)
      usage = { inputTokens: usage.inputTokens + answer.usage.inputTokens, outputTokens: usage.outputTokens + answer.usage.outputTokens }
      try {
        story = validateStory(JSON.parse(answer.text), words)
      } catch {
        story = null
      }
    }
    await db
      .insert('ai_generation_logs', { user_id: user.id, kind: 'story', status: story ? 'ok' : 'error', model: env.aiModel, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens })
      .catch(() => undefined)
    if (!story) throw new HttpError(502, 'ai_invalid_output', 'The story was not usable')

    const id = crypto.randomUUID()
    await db.insert('stories', { id, user_id: user.id, level, title_de: story.title_de, title_fa: story.title_fa, sentences: story.sentences, words: story.words })
    return json({ id, level, ...story }, 200, cors)
  } catch (err) {
    return errorResponse(err, cors)
  }
}
