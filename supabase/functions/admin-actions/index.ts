// Supabase Edge Function entry point (Deno). All logic lives in ../_shared so it can be unit-tested.
import { handleAdminActions } from '../_shared/adminActions.ts'
import { resolveServiceKey } from '../_shared/http.ts'

const env = (name: string) => Deno.env.get(name) || undefined

Deno.serve((req: Request) =>
  handleAdminActions(req, {
    supabaseUrl: env('SUPABASE_URL') ?? '',
    serviceRoleKey: resolveServiceKey(env),
    allowedOrigins: env('ALLOWED_ORIGINS') ?? '',
  }),
)
