'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DEMO_ACCOUNTS = [
  { name: 'User One', email: 'user1@demo.lovie.co' },
  { name: 'User Two', email: 'user2@demo.lovie.co' },
  { name: 'User Three', email: 'user3@demo.lovie.co' },
];
const DEMO_PASSWORD = '123';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ kind: 'err', text: error.message });
        return;
      }
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  const handleMagic = async () => {
    if (!email) {
      setMessage({ kind: 'err', text: 'Enter an email first.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMessage({ kind: 'err', text: error.message });
    else setMessage({ kind: 'ok', text: 'Magic link sent — check your inbox.' });
    setLoading(false);
  };

  const loginAsDemo = async (demoEmail: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: DEMO_PASSWORD,
      });
      if (error) {
        setMessage({
          kind: 'err',
          text: `${error.message}. Try "Or email me a magic link" with ${demoEmail}.`,
        });
        return;
      }
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left: brand */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-2)] text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-white grid place-items-center">
            <span className="text-[var(--color-brand)] font-bold">L</span>
          </div>
          <span className="font-semibold tracking-tight">Lovie</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Agent-native banking for the next generation of founders.
          </h1>
          <p className="mt-4 opacity-80 text-lg">
            Request, send, and schedule money with zero friction — from one panel.
          </p>
        </div>
        <div className="text-xs opacity-60">© {new Date().getFullYear()} Lovie</div>
      </div>

      {/* Right: login */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-[var(--color-brand)] grid place-items-center">
              <span className="text-white font-bold">L</span>
            </div>
            <span className="font-semibold tracking-tight">Lovie</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Access your payment requests and balance.
          </p>

          <form onSubmit={handlePassword} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-ink-3)]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-ink-3)]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-brand w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <button
            onClick={handleMagic}
            disabled={loading}
            className="mt-3 text-sm text-[var(--color-brand)] hover:underline"
          >
            Or email me a magic link
          </button>

          {message && (
            <div
              className={`mt-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] ${
                message.kind === 'err'
                  ? 'bg-red-50 text-red-700 border border-red-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">
              <div className="h-px bg-[var(--color-line)] flex-1" /> Demo accounts{' '}
              <div className="h-px bg-[var(--color-line)] flex-1" />
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Pre-loaded with 30 mock payments. Password: <code>{DEMO_PASSWORD}</code>
            </p>
            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => loginAsDemo(a.email)}
                  disabled={loading}
                  className="flex items-center justify-between px-4 py-3 rounded-[var(--radius-lovie)] border border-[var(--color-line)] bg-white hover:bg-[var(--color-bg)] transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-2)] grid place-items-center text-xs font-semibold">
                      {a.name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-[var(--color-muted)]">{a.email}</div>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-brand)] font-medium">
                    Enter →
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 text-sm text-[var(--color-muted)]">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-[var(--color-brand)] hover:underline">
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
