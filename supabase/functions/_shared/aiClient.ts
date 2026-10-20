/**
 * Calls the configured AI provider for one structured (JSON-schema) answer, with
 * retries for transient failures and clear errors for configuration problems.
 */
import { HttpError, type FetchLike } from './http.ts'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface AiEnv {
  aiApiKey: string
  aiModel: string
  aiBaseUrl: string
  aiApiStyle: 'responses' | 'chat'
  timeoutMs?: number
}

export async function callStructured(
  messages: ChatMessage[],
  env: AiEnv,
  output: { name: string; schema: Record<string, unknown>; maxOutputTokens?: number },
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
): Promise<{ text: string; usage: Usage }> {
  const base = env.aiBaseUrl.replace(/\/+$/, '')
  const format = { name: output.name, strict: true, schema: output.schema }
  const MAX_OUTPUT_TOKENS = output.maxOutputTokens ?? 8_000
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
    const timer = setTimeout(() => controller.abort(), env.timeoutMs ?? 60_000)
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
