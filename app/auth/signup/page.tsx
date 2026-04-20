'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export default function SignupPage() {
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) router.push('/auth/login');
      else setUser(u);
    })();
  }, [supabase, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');

    const { error: err } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email!,
        first_name: firstName,
        last_name: lastName,
        balance: 1000000,
      })
      .select();

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your profile</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--color-ink-3)]">First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
              className="input mt-1"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-ink-3)]">Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
              className="input mt-1"
              required
            />
          </div>
          <button disabled={loading} className="btn-brand w-full">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm px-3 py-2 rounded-[var(--radius-lovie)] bg-red-50 text-red-700 border border-red-100">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
