// Supabase Edge Function entry point (Deno). All logic lives in ../_shared so it can be unit-tested.
import { resolveServiceKey } from '../_shared/http.ts'
import { handleTts, TTS_DEFAULTS } from '../_shared/tts.ts'

const env = (name: string) => Deno.env.get(name) || undefined
const provider = (env('AI_PROVIDER') ?? 'openai').toLowerCase()

Deno.serve((req: Request) =>
  handleTts(req, {
    supabaseUrl: env('SUPABASE_URL') ?? '',
    serviceRoleKey: resolveServiceKey(env),
    allowedOrigins: env('ALLOWED_ORIGINS') ?? '',
    // speech needs OpenAI; the word service's key is reused when it is an OpenAI key
    ttsApiKey: env('TTS_API_KEY') ?? (provider === 'openai' ? env('AI_API_KEY') ?? env('OPENAI_API_KEY') ?? '' : ''),
    ttsBaseUrl: env('TTS_BASE_URL') ?? TTS_DEFAULTS.baseUrl,
    ttsModel: env('TTS_MODEL') ?? TTS_DEFAULTS.model,
    voiceFemale: env('TTS_VOICE_FEMALE') ?? TTS_DEFAULTS.female,
    voiceMale: env('TTS_VOICE_MALE') ?? TTS_DEFAULTS.male,
  }),
)
