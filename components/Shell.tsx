'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  children: ReactNode;
  user?: { first_name?: string; last_name?: string; email?: string } | null;
};

export default function Shell({ children, user }: Props) {
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/auth/login');
  };

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-line)] bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--color-brand)] grid place-items-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-semibold tracking-tight text-[var(--color-ink)]">
              Lovie <span className="text-[var(--color-muted)] font-normal">Payments</span>
            </span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg-2)] grid place-items-center text-xs font-semibold text-[var(--color-ink-2)]">
                  {initials}
                </div>
                <div className="leading-tight">
                  <div className="font-medium text-[var(--color-ink)]">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-[var(--color-muted)] text-xs">{user.email}</div>
                </div>
              </div>
              <button onClick={logout} className="btn-ghost text-sm">
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--color-line)] mt-12 py-6 text-center text-xs text-[var(--color-muted)]">
        Lovie P2P demo · Mock data · Built for the Lovie Feature Engineer interview
      </footer>
    </div>
  );
}
