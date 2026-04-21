'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function RequestShare() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const pinnedEmail = searchParams.get('e') || '';
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'anon' | 'wrong-account' | 'redirect' | 'error'>('loading');
  const [loggedInEmail, setLoggedInEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const userRes = await fetch('/api/auth/user', { credentials: 'include' });
      if (userRes.ok) {
        const me = await userRes.json();
        if (pinnedEmail && me.email !== pinnedEmail) {
          setLoggedInEmail(me.email);
          setState('wrong-account');
          return;
        }
        router.replace(`/requests/${id}`);
        setState('redirect');
        return;
      }
      setState('anon');
    })().catch(() => {
      setError('Could not load this request.');
      setState('error');
    });
  }, [id, router, pinnedEmail]);

  if (state === 'loading' || state === 'redirect') {
    return <div className="min-h-screen grid place-items-center text-sm text-[var(--color-muted)]">Loading…</div>;
  }

  if (state === 'wrong-account') {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 grid place-items-center mx-auto mb-4 text-2xl">⚠️</div>
          <h1 className="text-xl font-semibold tracking-tight">Wrong account</h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            This request was sent to <span className="font-medium text-[var(--color-ink)]">{pinnedEmail}</span>,
            but you&apos;re signed in as <span className="font-medium text-[var(--color-ink)]">{loggedInEmail}</span>.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                router.replace(`/auth/login?redirect=${encodeURIComponent(`/requests/${id}`)}&email=${encodeURIComponent(pinnedEmail)}`);
              }}
              className="btn-brand w-full"
            >
              Sign in as {pinnedEmail}
            </button>
            <Link href={`/requests/${id}`} className="btn-ghost w-full text-sm">
              Continue as {loggedInEmail}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const emailParam = pinnedEmail ? `&email=${encodeURIComponent(pinnedEmail)}` : '';
  const redirectParam = `redirect=${encodeURIComponent(`/requests/${id}`)}`;
  const loginHref = `/auth/login?${redirectParam}${emailParam}`;
  const signupHref = `/auth/signup?${redirectParam}${emailParam}`;

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--color-brand)] grid place-items-center mx-auto mb-4">
          <span className="text-white font-bold">L</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;ve got a payment request</h1>
        {error ? (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        ) : (
          <>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Sign in to view the details and pay, decline, or schedule.
            </p>
            {pinnedEmail && (
              <p className="text-xs text-[var(--color-muted)] mt-3">
                Sent to <span className="font-medium text-[var(--color-ink)]">{pinnedEmail}</span>
              </p>
            )}
          </>
        )}
        <div className="flex gap-3 mt-6 justify-center">
          <Link href={loginHref} className="btn-brand">Sign in</Link>
          <Link href={signupHref} className="btn-ghost">Create account</Link>
        </div>
      </div>
    </div>
  );
}
