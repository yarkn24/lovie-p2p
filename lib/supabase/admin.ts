import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS. Server-only — never expose to the
 * browser. Use it for admin-style enrichment reads (e.g. looking up
 * counterparty profile names) after you've already verified the calling
 * user's authorization through the RLS-scoped client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
