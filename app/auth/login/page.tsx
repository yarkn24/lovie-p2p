'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const DEMO_ACCOUNTS = [
  { name: 'Sarah Johnson',   email: 'sarah.demo@lovie.co', avatar: '/avatars/sarah.jpg' },
  { name: 'Michael Rodriguez', email: 'michael.demo@lovie.co', avatar: '/avatars/michael.png' },
  { name: 'David Chen',     email: 'david.demo@lovie.co', avatar: '/avatars/david.png' },
];
const DEMO_PASSWORD = '123';

function LoginInner() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const pinnedEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(pinnedEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const supabase = createClient();

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMessage({ kind: 'err', text: error.message }); return; }
      window.location.href = redirectTo;
    } finally {
      setLoading(false);
    }
  };

  const handleMagic = async () => {
    if (!email) { setMessage({ kind: 'err', text: 'Enter an email first.' }); return; }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
      });
      if (error) setMessage({ kind: 'err', text: error.message });
      else setMessage({ kind: 'ok', text: 'Magic link sent — check your inbox.' });
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async (demoEmail: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: DEMO_PASSWORD });
      if (error) {
        setMessage({ kind: 'err', text: `${error.message}. Try magic link with ${demoEmail}.` });
        return;
      }
      window.location.href = redirectTo;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left panel */}
      <div className="hidden md:flex flex-col justify-between p-12 text-white"
        style={{ background: 'linear-gradient(135deg, #0546bf 0%, #065b98 100%)' }}>
        <div className="flex items-center gap-3">
          <Image src="/lovie-logo.png" alt="Lovie" width={36} height={36} className="rounded-lg" />
          <span style={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Lovie</span>
        </div>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Agent-native banking for the next generation of founders.
          </h1>
          <p style={{ marginTop: '1rem', opacity: 0.8, fontSize: '1.125rem' }}>
            Request, send, and schedule money with zero friction — from one panel.
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>© {new Date().getFullYear()} Lovie</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <Image src="/lovie-logo.png" alt="Lovie" width={28} height={28} className="rounded-md" />
            <span style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>Lovie</span>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Sign in</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            Access your payment requests and balance.
          </p>

          <form onSubmit={handlePassword} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="input mt-1" placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input mt-1" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-brand w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <button onClick={handleMagic} disabled={loading}
            className="mt-3 text-sm hover:underline" style={{ color: 'var(--color-brand)' }}>
            Or email me a magic link
          </button>

          {message && (
            <div className={`mt-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] ${
              message.kind === 'err'
                ? 'bg-red-50 text-red-700 border border-red-100'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {message.text}
            </div>
          )}

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', fontWeight: 600 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
              Demo accounts
              <div style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
              Pre-loaded with 30 mock payments. Password: <code>123</code>
            </p>
            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} onClick={() => loginAsDemo(a.email)} disabled={loading}
                  className="flex items-center justify-between px-4 py-3 rounded-[var(--radius-lovie)] bg-white transition"
                  style={{ border: '1px solid var(--color-line)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-2)', flexShrink: 0 }}>
                      <Image src={a.avatar} alt={a.name} width={36} height={36}
                        className="w-full h-full object-cover" />
                    </div>
                    <div className="text-left">
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{a.email}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-brand)', fontWeight: 500 }}>
                    Enter →
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href={`/auth/signup${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} style={{ color: 'var(--color-brand)' }} className="hover:underline">
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
