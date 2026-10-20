// Supabase Edge Function entry point (Deno). All logic lives in ../_shared so it can be unit-tested.
import { resolveServiceKey } from '../_shared/http.ts'
import { handlePush } from '../_shared/push.ts'

const env = (name: string) => Deno.env.get(name) || undefined

Deno.serve((req: Request) =>
  handlePush(req, {
    supabaseUrl: env('SUPABASE_URL') ?? '',
    serviceRoleKey: resolveServiceKey(env),
    allowedOrigins: env('ALLOWED_ORIGINS') ?? '',
    pushSubject: env('PUSH_SUBJECT'),
    appUrl: env('APP_URL'),
  }),
)
