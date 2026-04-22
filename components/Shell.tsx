'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAvatar } from '@/lib/avatars';
import { createClient } from '@/lib/supabase/client';

type Notification = {
  id: string;
  message: string;
  request_id: string | null;
  read: boolean;
  created_at: string;
};

type Props = {
  children: ReactNode;
  user?: { id?: string; first_name?: string; last_name?: string; email?: string } | null;
};

export default function Shell({ children, user }: Props) {
  const router = useRouter();
  const avatar = getAvatar(user?.email);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load + realtime subscribe
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setNotifs(data ?? []));

    const channel = supabase
      .channel(`notifs:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifs((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    const supabase = createClient();
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/auth/login';
  };

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : (user?.email?.[0] ?? '?').toUpperCase();

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header style={{ borderBottom: '1px solid var(--color-line)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/lovie-logo.png" alt="Lovie" width={28} height={28} className="rounded-md" />
            <span style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
              Lovie <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Payments</span>
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-3">

              {/* Bell */}
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setOpen((o) => !o); if (!open) markAllRead(); }}
                  style={{ position: 'relative', width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: '50%', border: '1px solid var(--color-line)', background: 'white', cursor: 'pointer' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-ink)' }}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {unread > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, minWidth: 18, height: 18, display: 'grid', placeItems: 'center', padding: '0 4px', lineHeight: 1 }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                {open && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, background: 'white', borderRadius: 16, border: '1px solid var(--color-line)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden' }}>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notifications</span>
                      {notifs.length > 0 && (
                        <button onClick={markAllRead} style={{ fontSize: '0.75rem', color: 'var(--color-brand)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {notifs.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                          No notifications yet
                        </div>
                      ) : notifs.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => { if (n.request_id) { router.push(`/requests/${n.request_id}`); setOpen(false); } }}
                          style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-line)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: n.request_id ? 'pointer' : 'default', background: n.read ? 'white' : '#eff6ff', transition: 'background 0.15s' }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : '#2563eb', marginTop: 6, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-ink)', lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: 2 }}>{fmtTime(n.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
