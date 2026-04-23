'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      // Implicit flow puts tokens in the URL hash (#access_token=...&refresh_token=...).
      // detectSessionInUrl is on by default and picks them up automatically; we just
      // wait for the session to materialise, then decide where to send the user.
      // Give the browser client a tick to consume the hash.
      await new Promise((r) => setTimeout(r, 50));

      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !session?.user) {
        setError('Invalid or expired link. Please sign in or try signing up again.');
        setTimeout(() => router.replace('/auth/login?error=Invalid+or+expired+link'), 2000);
        return;
      }

      const user = session.user;
      const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string };

      // If signup metadata is present, create the profile row now (idempotent).
      if (meta.first_name && meta.last_name) {
        await supabase
          .from('users')
          .upsert(
            {
              id: user.id,
              email: user.email!,
              first_name: meta.first_name,
              last_name: meta.last_name,
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
      }

      // Check profile — if still missing, send to /auth/complete-profile.
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        router.replace('/auth/complete-profile');
        return;
      }

      const confirmed = new URL('/auth/confirmed', window.location.origin);
      confirmed.searchParams.set('next', next);
      router.replace(confirmed.pathname + confirmed.search);
    })();
  }, [router, next]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center text-sm text-[var(--color-muted)]">
      Finishing sign-in…
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-[var(--color-muted)]">Finishing sign-in…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
