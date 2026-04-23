'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LovieSplash from '../../components/LovieSplash';

function Confirmed() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const done = useCallback(() => router.replace(next), [next, router]);
  return <LovieSplash onDone={done} />;
}

export default function EmailConfirmed() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-[var(--color-muted)]">Loading…</div>}>
      <Confirmed />
    </Suspense>
  );
}
