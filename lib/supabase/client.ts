import { createBrowserClient } from '@supabase/ssr';

// Implicit flow (tokens in URL hash) instead of PKCE. Reason: users often
// sign up on desktop but click the confirmation link in their phone inbox,
// and PKCE requires the verifier to live in the originating browser's
// storage — it fails cross-device. Implicit lets any browser finish the
// verification by consuming the hash directly.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  );
}
