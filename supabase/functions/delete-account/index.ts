// Supabase Edge Function entry point (Deno).
import { handleDeleteAccount } from '../_shared/deleteAccount.ts'
import { resolveServiceKey } from '../_shared/http.ts'

Deno.serve((req: Request) =>
  handleDeleteAccount(req, {
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: resolveServiceKey((name) => Deno.env.get(name) || undefined),
    allowedOrigins: Deno.env.get('ALLOWED_ORIGINS') ?? '',
  }),
)
