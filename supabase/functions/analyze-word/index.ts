// Supabase Edge Function entry point (Deno). All logic lives in ../_shared so it can be unit-tested.
import { resolveAiSettings } from '../_shared/aiProviders.ts'
import { handleAnalyzeWord } from '../_shared/analyzeWord.ts'
import { resolveServiceKey } from '../_shared/http.ts'

const num = (name: string): number | undefined => {
  const raw = Deno.env.get(name)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

Deno.serve((req: Request) =>
  handleAnalyzeWord(req, {
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: resolveServiceKey((name) => Deno.env.get(name) || undefined),
    allowedOrigins: Deno.env.get('ALLOWED_ORIGINS') ?? '',
    ...resolveAiSettings((name) => Deno.env.get(name) || undefined),
    perMinuteLimit: num('AI_LIMIT_PER_MINUTE'),
    perDayLimit: num('AI_LIMIT_PER_DAY'),
    globalDayLimit: num('AI_LIMIT_GLOBAL_PER_DAY'),
    timeoutMs: num('AI_TIMEOUT_MS'),
  }),
)
