/**
 * POST /functions/v1/tts   { text, voice?: "female" | "male", language?: "de" | "en" | "fr" | "it" | "es" | "nl" }
 *
 * Natural speech in the learned language (German when none is given). Every text is synthesised once, stored as an MP3 in the public
 * "tts" storage bucket and shared by everyone afterwards — repeated plays cost nothing.
 */
import { checkAllowance } from './budget.ts'
import { adminRest, corsHeaders, errorResponse, HttpError, json, readJsonBody, requireUser, type FetchLike, type FunctionEnv } from './http.ts'

export interface TtsEnv extends FunctionEnv {
  /** OpenAI key (the same as AI_API_KEY when the word service uses OpenAI). */
  ttsApiKey: string
  ttsBaseUrl: string
  ttsModel: string
  voiceFemale: string
  voiceMale: string
  timeoutMs?: number
}

export const TTS_DEFAULTS = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts', female: 'nova', male: 'onyx' }
const MAX_CHARS = 300

/** How the voice should speak each learned language: clear standard pronunciation, like a teacher. */
export const SPEECH_STYLE: Record<string, string> = {
  de: 'Sprich klares, natürliches Hochdeutsch in ruhigem, deutlichem Tempo, wie eine freundliche Lehrerin.',
  en: 'Speak clear, natural standard British English at a calm, distinct pace, like a friendly teacher.',
  fr: 'Parle un français standard clair et naturel, à un rythme calme et distinct, comme une enseignante bienveillante.',
  it: 'Parla un italiano standard chiaro e naturale, con un ritmo calmo e scandito, come un’insegnante gentile.',
  es: 'Habla un español estándar claro y natural, a un ritmo tranquilo y claro, como una profesora amable.',
  nl: 'Spreek helder, natuurlijk standaard Nederlands in een rustig, duidelijk tempo, zoals een vriendelijke docent.',
}
const PERSIAN = /[؀-ۿ]/
const LATIN = /\p{Script=Latin}/u

export function normalizeSpeechText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.normalize('NFC').replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').replace(/\s+/g, ' ').trim()
  if (!text || text.length > MAX_CHARS || PERSIAN.test(text) || !LATIN.test(text)) return null
  return text
}

async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function handleTts(req: Request, env: TtsEnv, fetchImpl: FetchLike = fetch): Promise<Response> {
  const cors = corsHeaders(req, env)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST')
    if (!env.supabaseUrl || !env.serviceRoleKey) throw new HttpError(500, 'not_configured', 'Server is not configured')
    const user = await requireUser(req, env, fetchImpl)
    const body = await readJsonBody(req, 2_000)
    const text = normalizeSpeechText(body.text)
    if (!text) throw new HttpError(400, 'invalid_input', 'Text must be in a Latin-script language and at most 300 characters')
    const language = typeof body.language === 'string' && SPEECH_STYLE[body.language] ? body.language : 'de'
    const voiceName = body.voice === 'male' ? env.voiceMale : env.voiceFemale

    const db = adminRest(env, fetchImpl)
    // German keeps its old cache key, so the recordings made so far stay valid
    const hash = await sha256Hex(language === 'de' ? `${env.ttsModel}|${voiceName}|${text}` : `${env.ttsModel}|${voiceName}|${language}|${text}`)
    const publicUrl = (path: string) => `${env.supabaseUrl}/storage/v1/object/public/tts/${path}`

    const cached = await db.select<{ path: string }>(`tts_cache?hash=eq.${hash}&select=path`).catch(() => [])
    if (cached[0]) return json({ url: publicUrl(cached[0].path), cached: true }, 200, cors)

    if (!env.ttsApiKey) throw new HttpError(500, 'not_configured', 'Speech is not configured')
    await checkAllowance(db, user.id, 'tts', 300)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), env.timeoutMs ?? 30_000)
    let audio: ArrayBuffer
    try {
      const res = await fetchImpl(`${env.ttsBaseUrl.replace(/\/+$/, '')}/audio/speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.ttsApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.ttsModel,
          voice: voiceName,
          input: text,
          response_format: 'mp3',
          instructions: SPEECH_STYLE[language],
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error('tts provider error', res.status, detail.slice(0, 200))
        if (res.status === 401 || res.status === 403 || res.status === 404) throw new HttpError(500, 'not_configured', 'Speech service rejected the request')
        if (/insufficient_quota|billing/i.test(detail)) throw new HttpError(503, 'ai_quota_exhausted', 'The AI account has no credit left')
        throw new HttpError(502, 'ai_unavailable', 'Speech service failed')
      }
      audio = await res.arrayBuffer()
    } catch (err) {
      if (err instanceof HttpError) throw err
      if (err instanceof Error && err.name === 'AbortError') throw new HttpError(504, 'ai_timeout', 'Speech took too long')
      throw new HttpError(502, 'ai_unavailable', 'Speech service could not be reached')
    } finally {
      clearTimeout(timer)
    }
    if (audio.byteLength < 100) throw new HttpError(502, 'ai_unavailable', 'Speech service returned no audio')

    const path = `${hash.slice(0, 2)}/${hash}.mp3`
    const upload = await fetchImpl(`${env.supabaseUrl}/storage/v1/object/tts/${path}`, {
      method: 'POST',
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
      body: audio,
    })
    if (!upload.ok) {
      console.error('tts upload failed', upload.status)
      throw new HttpError(502, 'storage_failed', 'The audio could not be stored')
    }
    await db.insert('tts_cache', { hash, path, chars: text.length, voice: voiceName, model: env.ttsModel }, 'hash').catch(() => undefined)
    await db
      .insert('ai_generation_logs', { user_id: user.id, kind: 'tts', input: text.slice(0, 120), status: 'ok', model: env.ttsModel, input_tokens: text.length, output_tokens: 0 })
      .catch(() => undefined)
    return json({ url: publicUrl(path), cached: false }, 200, cors)
  } catch (err) {
    return errorResponse(err, cors)
  }
}
