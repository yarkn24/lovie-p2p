'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Email-verification landing page.
 *
 * Why this layer exists (instead of letting the email link hit Supabase's
 * /auth/v1/verify directly): Gmail / iCloud / Outlook run "link safety"
 * scanners that prefetch any URL in incoming mail. Supabase's verify endpoint
 * treats the token as single-use, so the scanner consumes it before the user
 * clicks — the user then sees "otp_expired".
 *
 * Our landing page is a GET that *does not* call verify on load. The scanner
 * hits the page, renders nothing, leaves. When the real user clicks the
 * Confirm button we call supabase.auth.verifyOtp({ token_hash, type }) — the
 * token is still valid because nobody has spent it yet.
 */
function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get('token_hash');
  const typeParam = params.get('type') ?? 'signup';
  const next = params.get('next') || '/';

  const [state, setState] = useState<'idle' | 'verifying' | 'error' | 'success'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tokenHash) {
      setState('error');
      setError('Missing confirmation token. Please use the link from your email.');
    }
  }, [tokenHash]);

  const handleConfirm = async () => {
    if (!tokenHash) return;
    setState('verifying');
    setError('');
    try {
      const supabase = createClient();
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: typeParam as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
      });
      if (vErr || !data.user) {
        setState('error');
        setError(vErr?.message ?? 'Verification failed. The link may be invalid or expired.');
        return;
      }

      const user = data.user;
      const meta = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string };
      if (meta.first_name && meta.last_name) {
        await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email!,
            first_name: meta.first_name,
            last_name: meta.last_name,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      }

      const { data: profile } = await supabase
        .from('users').select('id').eq('id', user.id).maybeSingle();
      if (!profile) {
        router.replace('/auth/complete-profile');
        return;
      }

      setState('success');
      const url = new URL('/auth/confirmed', window.location.origin);
      url.searchParams.set('next', next);
      router.replace(url.pathname + url.search);
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-[var(--color-cream)]">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-5 grid place-items-center" style={{ background: 'linear-gradient(135deg,#0546bf 0%,#06b6d4 100%)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
        <p className="text-sm text-[var(--color-muted)] mt-2">
          Click the button below to finish signing up.
        </p>
        {error && (
          <div className="mt-4 p-3 rounded-[var(--radius-lovie)] bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={state === 'verifying' || state === 'success' || !tokenHash}
          className="btn-brand w-full mt-6"
        >
          {state === 'verifying' ? 'Confirming…' : state === 'success' ? 'Confirmed ✓' : 'Confirm email'}
        </button>
        <p className="text-xs text-[var(--color-muted)] mt-4">
          This extra step protects your link from email security scanners.
        </p>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-[var(--color-muted)]">Loading…</div>}>
      <ConfirmInner />
    </Suspense>
  );
}
