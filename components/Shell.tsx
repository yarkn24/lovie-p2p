'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAvatar } from '@/lib/avatars';

type Props = {
  children: ReactNode;
  user?: { first_name?: string; last_name?: string; email?: string } | null;
};

export default function Shell({ children, user }: Props) {
  const router = useRouter();
  const avatar = getAvatar(user?.email);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/auth/login';
  };

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header style={{ borderBottom: '1px solid var(--color-line)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/lovie-logo.png" alt="Lovie" width={28} height={28} className="rounded-md" />
            <span style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
              Lovie <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Payments</span>
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5 text-sm">
                <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-2)', flexShrink: 0 }}>
                  {avatar ? (
                    <Image src={avatar} alt={user.first_name ?? ''} width={32} height={32} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs font-semibold" style={{ color: 'var(--color-ink-2)' }}>
                      {initials}
                    </div>
                  )}
                </div>
                <div className="leading-tight">
                  <div style={{ fontWeight: 500, color: 'var(--color-ink)' }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>{user.email}</div>
                </div>
              </div>
              <button onClick={logout} className="btn-ghost text-sm">
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer style={{ borderTop: '1px solid var(--color-line)', marginTop: '3rem', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
        Lovie P2P demo · Mock data · Built for the Lovie Feature Engineer interview
      </footer>
    </div>
  );
}
