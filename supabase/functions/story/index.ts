// Supabase Edge Function entry point (Deno). All logic lives in ../_shared so it can be unit-tested.
import { resolveAiSettings } from '../_shared/aiProviders.ts'
import { resolveServiceKey } from '../_shared/http.ts'
import { handleStory } from '../_shared/story.ts'

const env = (name: string) => Deno.env.get(name) || undefined

Deno.serve((req: Request) =>
  handleStory(req, {
    supabaseUrl: env('SUPABASE_URL') ?? '',
    serviceRoleKey: resolveServiceKey(env),
    allowedOrigins: env('ALLOWED_ORIGINS') ?? '',
    ...resolveAiSettings(env),
  }),
)
