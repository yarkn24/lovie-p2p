'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const pinnedEmail = searchParams.get('email') || '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(pinnedEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    // Check if email already exists in users table
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setError('You already have an account with this email. Please sign in instead.');
      return;
    }

    const redirectPath = `/auth/callback?next=${encodeURIComponent(redirectTo)}`;
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
        emailRedirectTo: `${window.location.origin}${redirectPath}`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="w-full max-w-md card p-8 text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 grid place-items-center"
            style={{ background: 'linear-gradient(135deg,#0546bf 0%,#06b6d4 100%)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            We sent a confirmation link to <span className="font-medium text-[var(--color-ink)]">{email}</span>.
            Click it to activate your account and sign in.
          </p>
          <Link href="/auth/login" className="btn-ghost mt-6 inline-block">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 text-white"
        style={{ background: 'linear-gradient(135deg, #0546bf 0%, #065b98 100%)' }}>
        <div className="flex items-center gap-3">
          <Image src="/lovie-logo.png" alt="Lovie" width={36} height={36} className="rounded-lg" />
          <span style={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Lovie</span>
        </div>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Create your Lovie account.
          </h1>
          <p style={{ marginTop: '1rem', opacity: 0.8, fontSize: '1.125rem' }}>
            Start requesting, sending, and scheduling money in minutes.
          </p>
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>© {new Date().getFullYear()} Lovie</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-8">
            <Image src="/lovie-logo.png" alt="Lovie" width={28} height={28} className="rounded-md" />
            <span style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>Lovie</span>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Create account</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            You&apos;ll receive a confirmation email to activate your account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>First name</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="input mt-1" placeholder="Jane" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>Last name</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="input mt-1" placeholder="Doe" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!pinnedEmail}
                className="input mt-1"
                placeholder="you@example.com"
                style={pinnedEmail ? { background: 'var(--color-bg)', cursor: 'not-allowed' } : undefined}
              />
              {pinnedEmail && (
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  This request was sent to this email — account must use it.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="input mt-1" placeholder="At least 8 characters" minLength={8} />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--color-ink-3)' }}>Confirm password</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="input mt-1" placeholder="Repeat password" />
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-[var(--radius-lovie)] bg-red-50 text-red-700 border border-red-100">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-brand w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--color-brand)' }} className="hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
