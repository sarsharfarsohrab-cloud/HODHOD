// Supabase Edge Function entry point (Deno).
import { handleDeleteAccount } from '../_shared/deleteAccount.ts'

Deno.serve((req: Request) =>
  handleDeleteAccount(req, {
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    allowedOrigins: Deno.env.get('ALLOWED_ORIGINS') ?? '',
  }),
)
