// Service-role Supabase client. SERVER-ONLY. Bypasses RLS.
// Use only in webhooks, edge functions, migrations, and admin/system tasks.
// Never import this into a Client Component.
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
