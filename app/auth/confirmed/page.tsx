'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function EmailConfirmed() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  useEffect(() => {
    const t = setTimeout(() => router.replace(next), 2500);
    return () => clearTimeout(t);
  }, [next, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-5 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M7 16l7 7 11-11" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div className="text-xl font-semibold text-[var(--color-ink)]">Email confirmed!</div>
          <div className="text-sm text-[var(--color-muted)] mt-1">Taking you to your dashboard…</div>
        </div>
        <Image src="/lovie-logo.png" alt="Lovie" width={28} height={28} className="lovie-loading opacity-60" />
      </div>
    </div>
  );
}
