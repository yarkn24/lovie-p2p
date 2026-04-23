'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function CompleteProfile() {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Session lost. Please sign in again.');
      setLoading(false);
      router.push('/auth/login');
      return;
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email!,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

    setLoading(false);

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique violation — profile already exists
        setSuccess(true);
        setTimeout(() => router.replace('/'), 2000);
      } else {
        setError(insertError.message);
      }
      return;
    }

    setSuccess(true);
    setTimeout(() => router.replace('/'), 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="w-full max-w-md card p-8 text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 grid place-items-center" style={{ background: 'linear-gradient(135deg,#0546bf 0%,#06b6d4 100%)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Profile created!</h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-md card p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Complete your profile</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">Thank you for confirming your email.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input"
              placeholder="John"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input"
              placeholder="Doe"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 rounded-[var(--radius-lovie)] bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-brand w-full mt-6"
          >
            {loading ? 'Creating profile…' : 'Continue'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-[var(--color-muted)]">
            Already have a profile?{' '}
            <Link href="/auth/login" className="text-[var(--color-brand)] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
