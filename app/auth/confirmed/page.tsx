'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function Confirmed() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-[var(--color-cream)]">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-5 grid place-items-center" style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Successfully authorized
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-2">
          {email ? (
            <>You&apos;re signed in as <span className="font-medium text-[var(--color-ink)]">{email}</span>.</>
          ) : (
            'Your account is ready.'
          )}
        </p>
        <button
          type="button"
          onClick={() => router.replace(next)}
          className="btn-brand w-full mt-6"
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}

export default function EmailConfirmed() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-[var(--color-muted)]">Loading…</div>}>
      <Confirmed />
    </Suspense>
  );
}
